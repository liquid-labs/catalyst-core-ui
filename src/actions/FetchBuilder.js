import * as appActions from './appActions'
import * as store from '../store'

import { config } from '../config'

class FetchBuilder {
  constructor(source) {
    this.source = source;
    this.url = config.baseUrl + source;
    this.method = 'GET'; // default method if none specified
    this.isForced = false; // by default we do not force the fetch
  }
  forPost() {
    this.method = 'POST';
    return this;
  }
  forPut() {
    this.method = 'PUT';
    return this;
  }
  forDelete() {
    this.method = 'DELETE';
    return this;
  }
  withJson(data) {
    this.payload = JSON.stringify(data);
    this.contentType = 'application/json';
    return this;
  }
  withToken() {
    this.withToken = true;
    return this;
  }
  withRequestAction(requestAction) {
    this.requestAction = requestAction;
    return this;
  }
  withSuccessAction(successAction) {
    this.successAction = successAction;
    return this;
  }
  withFailureAction(failureAction) {
    this.failureAction = failureAction;
    return this;
  }
  withValidator(validator) {
    this.validator = validator;
    return this;
  }
  withInFlightCheck() {
    this.checkInFlight = true
    return this
  }
  withPreFlightCheck(func) {
    this.preFlightCheck = func
    return this
  }
  force() {
    this.isForced = true
    return this
  }

  build() {
    if (!this.successAction) {
      throw new Error("No success handler defined.");
    }

    return (dispatch, getState) => {
      if (this.checkInFlight) {
        // Preflight checks:
        // 1) Are we already fetching?
        if (store.isFetching(this.source)) {
          return Promise.resolve(null)
        }
        // 2) Is the source in permanent error?
        if (!this.isForced) {
          const permanentError =
            store.sourcePermanentError(this.source)
          if (permanentError) {
            // TODO: causing redundicies with the general '_FAILURE' reducer from the 'appReducer'
            /*const msg = `${permanentError.message} (${this.source})`
            dispatch(appActions.setErrorMessage(msg))*/
            return Promise.resolve(null)
          }
        }
      }
      if (this.checkPreflight && !this.checkPreFlight()) {
        return Promise.resolve(null)
      }

      // Ready to go!
      // 1) Dispatch the 'REQUEST' action.
      if (this.requestAction) dispatch(this.requestAction.call(null, this.source));

      // 2) Prepare to issue the async call.
      // 2a) Prepare the auth header.
      let headers = {};
      if (this.withToken) {
        let token = getState().sessionState.authToken;
        if (!token) {
          const msg = `Request to '${this.url}' requires authentication.`;
          dispatch(appActions.setErrorMessage(msg));
          return Promise.resolve(null);
        }
        headers['Authorization'] = `Bearer ${token}`;
      }
      // 2b) Set the basic options.
      let fetchOptions = {
        method: this.method,
        headers: headers
      };
      // 2c) Setup the cors policy based on production or dev context.
      //     Note: 'production' here just means "in the cloud".
      if (process.env.NODE_ENV !== 'production') {
        fetchOptions.mode = 'cors';
      }
      else {
        fetchOptions.mode = 'same-origin';
      }
      // 2d) Set payload info.
      if (this.payload) {
        fetchOptions.body = this.payload;
        headers['Content-Type'] = this.contentType;
      }

      // 3) Do the fetch and return the Promise.
      return fetch(this.url, fetchOptions)
        .then(response => {
          if(response.ok){
            return response.json().then(data => {
              let error;
              if (!this.validator || !(error = this.validator(data)))
                return dispatch(this.successAction.call(null, data, this.source))
              else
                return dispatch(this.failureAction.call(null,
                  error,
                  response.status,
                  this.source));
            })
          }
          else{
            // TODO: support JSON errors with fallback
            return response.text().then(errorText => {
              if (this.failureAction)
                return dispatch(this.failureAction.call(null,
                  errorText,
                  response.status,
                  this.source));
            })
          }
        })
        .catch((error) => {
          console.warn(error);
          if (this.failureAction)
            return dispatch(this.failureAction.call(null,
              error + "",
              500,
              this.source));
        })
    }
  }
}

export default FetchBuilder;