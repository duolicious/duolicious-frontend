import {
  useLayoutEffect,
  useState,
} from 'react';
import { japi } from '../api/api';
import { listen, notify } from '../events/events';
import { setConversationArchived } from '../chat/application-layer';
import * as _ from 'lodash';

// TODO: The spinner doesn't spin when skipping a profile

type SkippedNetworkState
  = 'fetching'
  | 'posting'
  | 'settled'

type SkippedState = {
  isSkipped: boolean
  networkState: SkippedNetworkState
};

const useSkipped = (
  personUuid: string | null | undefined,
  onPostSkip?: () => void /* TODO: Should only run if posting a skip, not an unskip */
) => {
  const [state, setState] = useState<SkippedState>({
    isSkipped: false,
    networkState: 'settled',
  });

  useLayoutEffect(() => {
    if (!personUuid) {
      return;
    }

    return listen<Partial<SkippedState>>(
      `skipped-state-${personUuid}`,
      (partialNewData: SkippedState | undefined) => {
        if (partialNewData === undefined) {
          return;
        }

        setState((oldData) => {
          const newData = { ...oldData, ...partialNewData};
          if (_.isEqual(oldData, newData)) {
            return oldData;
          } else {
            return newData;
          }
        });

        if (
          partialNewData.isSkipped &&
          partialNewData.networkState === 'posting'
        ) {
          onPostSkip?.();
        }
      },
      true,
    );
  }, [personUuid]);

  return {
    isSkipped: state.isSkipped,
    isLoading: state.networkState !== 'settled',
    isFetching: state.networkState === 'fetching',
    isPosting: state.networkState === 'posting',
  };
};

const setSkipped = (
  personUuid: string,
  state: Partial<SkippedState>
) => {
  notify<Partial<SkippedState>>(`skipped-state-${personUuid}`, state);
};

const postSkipped = async (
  personUuid: string,
  isSkipped: boolean,
  reportReason?: string,
): Promise<boolean> => {
  const endpoint = (
    isSkipped ?
    `/skip/by-uuid/${personUuid}` :
    `/unskip/by-uuid/${personUuid}`);

  const payload =
    (isSkipped && reportReason) ?
    { report_reason: reportReason } :
    undefined;

  setSkipped(personUuid, { isSkipped, networkState: 'posting' });

  const response = await japi('post', endpoint, payload);

  if (!response.ok) {
    return false;
  }

  setSkipped(personUuid, { networkState: 'settled' });

  setConversationArchived(personUuid, isSkipped);

  return true;
};

export {
  postSkipped,
  useSkipped,
  setSkipped,
};
