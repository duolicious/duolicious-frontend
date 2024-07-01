import {useCallback, useEffect, useRef, useState} from "react";
import {fetchPage, PageItem, RESULTS_PER_PAGE} from "./search-tab";
import {ScrollView} from "react-native";
import {delay} from "../util/util";
import {listen} from "../events/events";

export const useNextProfileHook = (index: number, isActive: boolean) => {
  if (!isActive) {
    return {}
  }
  
  const scrollViewRef = useRef<ScrollView>(null)
  const page = Math.floor(index / RESULTS_PER_PAGE) + 1;
  const profileIdx = index % RESULTS_PER_PAGE
  
  const [items, setItems] = useState<PageItem[]>([])
  const [itemsIdx, setItemsIdx] = useState(profileIdx)
  const pageIdx = useRef(page)
  
  const [isError, setIsError] = useState(false)
  const [isEnd, setIsEnd] = useState(false)
  const isLoadingNextProfile = useRef(false)
  
  const item = items[itemsIdx]
  
  const fetchNext = useCallback(async () => {
    const pages = await fetchPage(pageIdx.current)
    
    if (!pages) {
      setIsError(true)
      return
    }
    
    if (!pages.length) {
      setIsEnd(true)
      return
    }
    
    pageIdx.current++;
    setItems(prev => [...prev, ...pages])
  }, [])
  
  useEffect(() => {
    fetchNext()
  }, []);
  
  const nextProfile = async () => {
    isLoadingNextProfile.current = true
    if (!items[itemsIdx + 1]) {
      await fetchNext()
    }
    
    setItemsIdx(idx => idx + 1)
    isLoadingNextProfile.current = false
  }
  
  const onScroll = async (event) => {
    await delay(500)
    
    const {nativeEvent: {contentOffset, layoutMeasurement, contentSize}} = event
    const isNearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 5
    
    if (isNearEnd) {
      scrollViewRef.current?.scrollTo({y: 0, animated: false});
      await nextProfile();
    }
  }
  
  useEffect(() => {
    if (!item) {
      return
    }
    
    return listen(`skip-profile-${item.prospect_person_id}`, nextProfile);
  }, [item, nextProfile]);
  
  return {
    item,
    isEnd,
    isError,
    isLoading: isLoadingNextProfile.current,
    onScroll,
    scrollViewRef,
  }
}
