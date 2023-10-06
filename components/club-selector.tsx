import {
  ActivityIndicator,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import CheckBox from './check-box';
import { ButtonWithCenteredText } from './button/centered-text';
import { DefaultText } from './default-text';
import { TopNavBar } from './top-nav-bar';
import { ButtonForOption } from './button/option';
import { Title } from './title';
import {
  OptionGroup,
  OptionGroupInputs,
  searchBasicsOptionGroups,
  searchInteractionsOptionGroups,
  getCurrentValue,
  isOptionGroupCheckChips,
  isOptionGroupRangeSlider,
  isOptionGroupButtons,
  isOptionGroupSlider,
} from '../data/option-groups';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OptionScreen } from './option-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTextInput } from './default-text-input';
import { SearchQuizCard } from './quiz-card';
import { api, japi } from '../api/api';
import * as _ from "lodash";
import { signedInUser } from '../App';
import { cmToFeetInchesStr, kmToMilesStr } from '../units/units';
import debounce from 'lodash/debounce';
import { Notice } from './notice';
import { Basic } from './basic';
import { notify } from '../events/events';

type ClubItem = {
  club_id: number,
  num_members: number,
  club_name: string,
};

const SelectedClub = ({
  clubItem,
  onPress,
}: {
  clubItem: ClubItem
  onPress: (clubItem: ClubItem ) => any
}) => {
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
      onPress={() => onPress(clubItem)}
    >
      <Basic
        style={{
          backgroundColor: 'rgba(119, 0, 255, 0.1)',
        }}
        textStyle={{
          color: '#70f',
        }}
      >
        {clubItem.club_name}
      </Basic>
    </Pressable>
  );
};

const UnselectedClub = ({
  clubItem,
  onPress,
}: {
  clubItem: ClubItem
  onPress: (clubItem: ClubItem ) => any
}) => {
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
      onPress={() => onPress(clubItem)}
    >
      <Basic
        style={{
          marginTop: 5,
          marginBottom: 5,
        }}
      >{clubItem.club_name}</Basic>
      <DefaultText style={{fontWeight: '700'}}>{clubItem.num_members} people</DefaultText>
    </Pressable>
  );
};

const fetchClubItems = async (q: string): Promise<ClubItem[]> => {
  return [
    { club_id:  1, num_members: 701, club_name: `The "I don't like clubs" club` },
    { club_id:  2, num_members:   2, club_name: `Teddy Appreciators` },
    { club_id:  3, num_members:  42, club_name: `/soc/` },
    { club_id:  4, num_members:  32, club_name: `/v/` },
    { club_id:  5, num_members:  42, club_name: `/cm/` },
    { club_id:  6, num_members:  69, club_name: `Anime` },
    { club_id:  7, num_members:  43, club_name: `Music` },
    { club_id:  8, num_members:  42, club_name: `Normies` },
    { club_id:  9, num_members:   1, club_name: `Guro` },
    { club_id: 10, num_members:  42, club_name: `straya` },
    { club_id: 10, num_members:  42, club_name: `murka` },
  ];

  // TODO
  // const resultsPerPage = 25;
  // const offset = 0;

  // const response = await api(
  //   'get',
  //   `/search-filter-questions` +
  //   `?q=${encodeURIComponent(q)}&n=${resultsPerPage}&o=${offset}`,
  // );

  // return response.ok ? response.json : [];
};

const ClubSelector = ({navigation, route}) => {
  const [selectedClubs, setSelectedClubs] = useState<
    ClubItem[]
  >(route?.params?.selectedClubs ?? []);

  const [searchResults, setSearchResults] = useState<ClubItem[]>([]);

  const [searchText, setSearchText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const clearSearchText = useCallback(() => setSearchText(""), []);

  const _fetchClubItems = useCallback(debounce(async (q: string) => {
    const results = await fetchClubItems(q);

    setSearchResults(results);
    setIsLoading(false);
  }, 500), []);

  const onChangeTextDebounced = useCallback(async (q: string) => {
    setSearchText(q);
    setSearchResults([]);
    setIsLoading(true);
    await _fetchClubItems(q);
  }, [_fetchClubItems]);

  const onSelectClub = useCallback((club: ClubItem) => {
    const newSelectedClubs = [...selectedClubs, club].sort((a, b) => {
      if (a.club_name > b.club_name) return +1;
      if (a.club_name < b.club_name) return -1;
      return 0;
    });

    const newUnselectedClubs = searchResults.filter((c) => c !== club);

    setSelectedClubs(newSelectedClubs);
    setSearchResults(newUnselectedClubs);

    notify('updated-clubs', newSelectedClubs);
  }, [selectedClubs, searchResults]);

  const onUnselectClub = useCallback((club: ClubItem) => {
    const newSelectedClubs = selectedClubs.filter((c) => c !== club);
    const newUnselectedClubs = [...searchResults, club].sort((a, b) => {
      if (a.num_members < b.num_members) return +1;
      if (a.num_members > b.num_members) return -1;
      return 0;
    });

    setSelectedClubs(newSelectedClubs);
    setSearchResults(newUnselectedClubs);

    notify('updated-clubs', newSelectedClubs);
  }, [selectedClubs, searchResults]);

  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'stretch',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            zIndex: 999,
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '100%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
        >
          <Ionicons
            style={{
              fontSize: 20,
            }}
            name="arrow-back"
          />
        </Pressable>
        <DefaultTextInput
          placeholder="Search clubs..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderRadius: 0,
            borderWidth: 0,
            height: '100%',
          }}
          value={searchText}
          onChangeText={onChangeTextDebounced}
        />
        {searchText !== "" &&
          <Pressable
            onPress={clearSearchText}
            style={{
              zIndex: 999,
              position: 'absolute',
              bottom: 0,
              right: 0,
              height: '100%',
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons
              style={{
                fontSize: 20,
              }}
              name="close"
            />
          </Pressable>
        }
      </TopNavBar>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
          paddingLeft: 10,
          paddingRight: 10,
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!_.isEmpty(selectedClubs) &&
          <>
            <Title>Clubs you're in ({(selectedClubs ?? []).length})</Title>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
              }}
            >
              {(selectedClubs ?? []).map((a, i) =>
                <SelectedClub key={String(i)} clubItem={a} onPress={onUnselectClub} />
              )}
            </View>
          </>
        }
        {_.isEmpty(selectedClubs) && (_.isEmpty(searchResults) || searchText === "") &&
          <DefaultText
            style={{
              fontFamily: 'Trueno',
              margin: '20%',
              textAlign: 'center'
            }}
          >
            You haven't joined any clubs
          </DefaultText>
        }

        {searchText !== "" &&
          <Title>Search Results</Title>
        }
        {isLoading &&
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
            }}
          >
            <ActivityIndicator size={60} color="#70f"/>
          </View>
        }
        {!isLoading && searchText !== "" && _.isEmpty(searchResults) &&
          <DefaultText
            style={{
              fontFamily: 'Trueno',
              margin: '20%',
              textAlign: 'center'
            }}
          >
            Your search didn't match any Q&A questions
          </DefaultText>
        }
        {!isLoading && searchText !== "" && !_.isEmpty(searchResults) &&
          <>
            {(searchResults ?? []).map((a, i) =>
              <UnselectedClub key={String(i)} clubItem={a} onPress={onSelectClub} />
            )}
            <Notice style={{ marginTop: 5, marginBottom: 5, marginLeft: 0, marginRight: 0 }}>
              <DefaultText style={{color: '#70f'}} >
                No more search results to show
              </DefaultText>
            </Notice>
          </>
        }
      </ScrollView>
    </>
  );
};






export {
  ClubSelector,
};
