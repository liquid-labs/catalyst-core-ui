import configureStore from './configureStore'

import moment from 'moment-timezone'

// Amount of time in seconds for which a fetched result (list or item) is
// considered fresh.
const refreshDelay = 5 * 60

export const store = configureStore()

export const getState = () => store.getState()

const getResourceState = () => getState()['resourceState']

export const isFetching = (source) =>
  getResourceState().inFlightSources[source]

export const sourcePermanentError = (source) => {
  const sourceInfo = getResourceState()['sources'][source]
  return sourceInfo ? sourceInfo.permanentError : null
}

// TODO: store this in the resourceReducer?
const emptySourceData = {
  source: null,
  lastChecked: null,
  permanentError: null,
  refList: null,
  itemList: null,
  itemListSeq: null
}

export const getCompleteItem = (itemId) => {
  const item = getResourceState().items[itemId]
  return item && item.isComplete() ? item : null
}

export const getFreshCompleteItem = (itemId) => {
  const item = getCompleteItem(itemId)
  if (item) {
    const sourceData = getSourceData(itemId)
    if (sourceData && !moment().isAfter(moment(sourceData.lastChecked).add(refreshDelay, 'seconds'))) {
      return item
    }
  }
  return null
}

export const getSourceData = (source) => {
  const rs = getResourceState()
  const sourceData = rs.sources[source]
  if (!sourceData) {
    return emptySourceData
  }
  else if (!sourceData.itemList
      || (rs.refreshItemListsBefore
          && rs.refreshItemListsBefore > sourceData.itemListSeq)) {
    const itemList = []
    // We have data on the source.
    // 1) If 'refList' is null, then we can't say anything more about it.
    if (!sourceData.refList) {
      return sourceData
    }
    // 2) Otherwise, we simultaneously buld the item list, but bail out and
    //    return the empty list if there are any invalid references. An invalid
    //    reference means the current data is out of date and we can say nothing
    //    about the state of the source at the moment.
    else if (sourceData.refList.some((ref) => {
          const item = rs.items[ref]
          if (!item) {
            return true
          }
          else {
            itemList.push(item)
            return false
          }
        })) {
      return emptySourceData
    }
    // 3) If we don't bail out of building the itemList, then cache it and return
    //    return the updated source.
    else {
      return {
        ...sourceData,
        itemList: itemList,
        itemListSeq: rs.refreshItemListsBefore
      }
    }
  }
  else { // We've got a valid source data with a live item list. Just return it.
    return sourceData
  }
}

export const getFreshSourceData = (source) => {
  const sourceData = getResourceState().sources[source]
  if (sourceData && !moment().isAfter(moment(sourceData.lastChecked).add(refreshDelay, 'seconds'))) {
    return getSourceData(source)
  }
  else {
    return emptySourceData
  }
}

// TODO: drop sepecial casing of events
// Note that events should generally be fetched first and then retreived via
// this method on success fetch (rather than going directly here).
export const getItemEventList = (pubId) => getResourceState().events[pubId]

export default store