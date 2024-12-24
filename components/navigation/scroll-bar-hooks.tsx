import {
  useEffect,
  useRef,
} from 'react';
import {
  isMobile,
} from '../../util/util';
import { findDOMNode } from 'react-dom';
import { notify } from '../../events/events';
import { ScrollViewData } from '../navigation/scroll-bar';

// TODO: make the functions do nothing on mobile

const useScrollbar = (controller: string) => {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastScrollViewHeight = useRef(0);
  const lastContentHeight = useRef(0);
  const lastOffset = useRef(0);

  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
    }
  }, []);

  return useRef({
    onLayout: (params) => {
      lastScrollViewHeight.current = params.nativeEvent.layout.height;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          scrollViewHeight: lastScrollViewHeight.current,
          contentHeight: lastContentHeight.current,
          offset: lastOffset.current,
        }
      );
    },
    onContentSizeChange: (contentWidth, contentHeight) => {
      lastContentHeight.current = contentHeight;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          scrollViewHeight: lastScrollViewHeight.current,
          contentHeight: lastContentHeight.current,
          offset: lastOffset.current,
        }
      );
    },
    onScroll: ({nativeEvent}) => {
      lastOffset.current = nativeEvent.contentOffset.y;

      notify<ScrollViewData>(
        'main-scroll-view',
        {
          controller,
          offset: lastOffset.current,
        }
      )
    },
    showsVerticalScrollIndicator: isMobile(),
    observeListRef: (listRef?: any) => (node): React.MutableRefObject<any> => {
      if (listRef !== undefined) {
        listRef.current = node;
      }

      if (isMobile()) {
        return listRef;
      }
      if (!node) {
        return listRef;
      }

      if (observer.current) {
        observer.current.disconnect();
      }

      console.log('making observer', controller); // TODO

      observer.current = new IntersectionObserver(
        ([entry]) => {
          console.log('is intersecting', controller, entry.isIntersecting); // TODO

          if (!entry.isIntersecting) {
            notify<ScrollViewData>(
              'main-scroll-view',
              {
                controller,
                onThumbDrag: null,
              }
            );

            return;
          }

          console.log('last offset', controller, lastOffset.current); // TODO

          notify<ScrollViewData>(
            'main-scroll-view',
            {
              controller,
              scrollViewHeight: lastScrollViewHeight.current,
              contentHeight: lastContentHeight.current,
              offset: lastOffset.current,
              onThumbDrag: (offset: number) => node.scrollToOffset({
                offset,
                animated: false,
              })
            }
          );
        },
        { root: null }
      );

      observer.current.observe(findDOMNode(node));

      return listRef;
    }
  }).current;
};

export {
  useScrollbar,
};
