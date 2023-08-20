import {
  ActivityIndicator,
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
import { DefaultFlatList } from './default-flat-list';
import { api, japi } from '../api/api';
import * as _ from "lodash";
import { signedInUser } from '../App';
import { cmToFeetInchesStr, kmToMilesStr } from '../units/units';

const getCurrentValueAsLabel = (og: OptionGroup<OptionGroupInputs> | undefined) => {
  if (!og) return undefined;

  const currentValue = getCurrentValue(og.input);

  if (
    isOptionGroupCheckChips(og.input) &&
    _.isArray(currentValue) &&
    _.every(currentValue, _.isString)
  ) {
    if (currentValue.length === og.input.checkChips.values.length) {
      return undefined;
    } else {
      return currentValue.join(', ');
    }
  } else if (isOptionGroupSlider(og.input)) {
    const currentValue = og.input.slider.currentValue;

    if (currentValue === undefined) {
      return undefined;
    } else if (og.title === 'Furthest Distance') {
      return currentValue === undefined ? 'any' :
        signedInUser?.units === 'Imperial' ?
        `${kmToMilesStr(currentValue)} mi.` :
        `${currentValue} km`;
    } else {
      return `${currentValue}`;
    }
  } else if (
    isOptionGroupRangeSlider(og.input) &&
    typeof currentValue === 'object' &&
    'sliderMin' in currentValue &&
    'sliderMax' in currentValue
  ) {
    const currentMin = og.input.rangeSlider.currentMin;
    const currentMax = og.input.rangeSlider.currentMax;

    if (currentMin === undefined && currentMax === undefined) {
      return undefined;
    } else if (og.title === 'Age') {
      return `${currentMin ?? 'any'}–${currentMax ?? 'any'} years`;
    } else if (og.title === 'Height') {
      const _currentMin = currentMin === undefined ? 'any' :
        signedInUser?.units === 'Imperial' ?
        cmToFeetInchesStr(currentMin) :
        `${currentMin} cm`;

      const _currentMax = currentMax === undefined ? 'any' :
        signedInUser?.units === 'Imperial' ?
        cmToFeetInchesStr(currentMax) :
        `${currentMax} cm`;

      return `${_currentMin}–${_currentMax}`;
    } else {
      return `${currentMin ?? 'any'}–${currentMax ?? 'any'}`;
    }
  } else {
    return currentValue;
  }
};

const optionGroupToDataKey = (og: OptionGroup<OptionGroupInputs>) => {
  if (og.title === "People You've Messaged")
    return 'people_messaged';

  if (og.title === "People You've Hidden")
    return 'people_hidden';

  if (og.title === "People You've Blocked")
    return 'people_blocked';

  return og.title.toLowerCase().replaceAll(' ', '_');
};

const Stack = createNativeStackNavigator();

const SearchFilterScreen = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Search Filter Tab" component={SearchFilterScreen_} />
      <Stack.Screen name="Search Filter Option Screen" component={OptionScreen} />
      <Stack.Screen name="Q&A Filter Screen" component={QandQFilterScreen} />
    </Stack.Navigator>
  );
};

const SearchFilterScreen_ = ({navigation}) => {
  const [, triggerRender] = useState({});
  const [data, setData] = useState<any>(null);

  const onSubmitSuccess = useCallback(() => {
    triggerRender({});
  }, [triggerRender]);

  const Button_ = useCallback((props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Search Filter Option Screen"
      showSkipButton={false}
      buttonTextColor="white"
      buttonBackgroundColor="#70f"
      buttonBorderWidth={0}
      noSettingText="Any"
      onSubmitSuccess={onSubmitSuccess}
      {...props}
    />;
  }, []);

  const addCurrentValue = (optionGroups: OptionGroup<OptionGroupInputs>[]) =>
    optionGroups.map(
      (
        og: OptionGroup<OptionGroupInputs>,
        i: number
      ): OptionGroup<OptionGroupInputs> =>
        _.merge(
          {},
          og,
          isOptionGroupCheckChips(og.input) ? {
            input: {
              checkChips: {
                values: og.input.checkChips.values.map((v) => ({
                  ...v,
                  checked: (
                    (data ?? {})[
                      optionGroupToDataKey(og)
                    ] ?? ([] as string[])
                  ).includes(v.label)
                }))
              }
            }
          } : {},
          isOptionGroupButtons(og.input) ? {
            input: {
              buttons: {
                currentValue: (data ?? {})[optionGroupToDataKey(og)]
              }
            }
          } : {},
          isOptionGroupSlider(og.input) ? {
            input: {
              slider: {
                currentValue: (data ?? {})[optionGroupToDataKey(og)]
              }
            }
          } : {},
          isOptionGroupRangeSlider(og.input) && og.title === 'Age' ? {
            input: {
              rangeSlider: {
                currentMin: (data ?? {})[optionGroupToDataKey(og)]?.min_age,
                currentMax: (data ?? {})[optionGroupToDataKey(og)]?.max_age,
              }
            }
          } : {},
          isOptionGroupRangeSlider(og.input) && og.title === 'Height' ? {
            input: {
              rangeSlider: {
                currentMin: (data ?? {})[optionGroupToDataKey(og)]?.min_height_cm,
                currentMax: (data ?? {})[optionGroupToDataKey(og)]?.max_height_cm,
              }
            }
          } : {},
        )
    );

  useEffect(() => {
    (async () => {
      const response = await api('get', '/search-filters');
      if (response.json) {
        setData(response.json);
      }
    })();
  }, []);

  const [
    _searchBasicsOptionGroups,
    _searchInteractionsOptionGroups,
  ] = useMemo(
    () => [
      addCurrentValue(searchBasicsOptionGroups),
      addCurrentValue(searchInteractionsOptionGroups),
    ],
    [data]
  );

  useEffect(() => {
    _searchBasicsOptionGroups.forEach((og: OptionGroup<OptionGroupInputs>) => {
      if (isOptionGroupSlider(og.input) && og.title === 'Furthest Distance') {
        og.input.slider.unitsLabel = (
          signedInUser?.units === 'Imperial' ?
          "mi." : 'km');

        og.input.slider.valueRewriter = (
          signedInUser?.units === 'Imperial' ?
          kmToMilesStr : undefined);
      }

      if (isOptionGroupRangeSlider(og.input) && og.title === 'Height') {
        og.input.rangeSlider.unitsLabel = (
          signedInUser?.units === 'Imperial' ?
          "ft'in\"" : 'cm');

        og.input.rangeSlider.valueRewriter = (
          signedInUser?.units === 'Imperial' ?
          cmToFeetInchesStr : undefined);
      }
    });
  }, [_searchBasicsOptionGroups, signedInUser?.units]);

  return (
    <>
      <TopNavBar
        style={{
          alignItems: 'center',
          justifyContent: 'center',
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
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Search Filters
        </DefaultText>
      </TopNavBar>

      {data &&
        <ScrollView
          contentContainerStyle={{
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
            alignItems: 'stretch',
            padding: 10,
          }}
        >
          <Title>Q&A Answers</Title>
          <ButtonForOption
            label="Q&A Answers"
            noSettingText="Any"
            onPress={() => navigation.navigate("Q&A Filter Screen")}
          />
          <Title>Basics</Title>
          {
            _searchBasicsOptionGroups.map((og, i) =>
              <Button_
                key={i}
                setting={getCurrentValueAsLabel(og)}
                optionGroups={_searchBasicsOptionGroups.slice(i)}
              />
            )
          }
          <Title>Interactions</Title>
          {
            _searchInteractionsOptionGroups.map((og, i) =>
              <Button_
                key={i}
                setting={getCurrentValueAsLabel(og)}
                optionGroups={_searchInteractionsOptionGroups.slice(i)}
              />
            )
          }
        </ScrollView>
      }
      {!data &&
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
    </>
  );
};

const QandQFilterScreen = ({navigation}) => {
  const [searchText, setSearchText] = useState("");

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
          placeholder="Search Questions..."
          style={{
            marginLeft: 50,
            marginRight: 50,
            borderRadius: 0,
            borderWidth: 0,
            height: '100%',
          }}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText !== "" &&
          <Pressable
            onPress={() => setSearchText("")}
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
      <DefaultFlatList
        contentContainerStyle={{
          paddingTop: 0,
          paddingLeft: 10,
          paddingRight: 10,
        }}
        emptyText={
          searchText === "" ?
            "You haven't added any Q&A filters" :
            "Your search didn't match any Q&A questions"
        }
        endText={
          searchText === "" ?
            "You haven't added any other Q&A filters" :
            "No more Q&A questions to show"
        }
        dataKey={searchText}
        fetchPage={async (): Promise<any[]> => await Array(1)}
        ListHeaderComponent={
          searchText === "" ?
          <Title>Q&A Answers You'll Accept</Title> :
          <Title>Search Results</Title>
        }
        renderItem={(x) =>
          <SearchQuizCard
            questionNumber={420}
            topic="Faith"
            answer="yes"
          >
            Do you believe in the power of your PlayStation?
          </SearchQuizCard>
        }
      />
    </>
  );
};

export {
  SearchFilterScreen,
}
