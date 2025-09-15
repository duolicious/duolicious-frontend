import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { DefaultTextInput } from './default-text-input';
import { japi } from '../api/api';
import * as _ from "lodash";
import { useAppTheme } from '../app-theme/app-theme';

const LocationSelector = ({onChangeText, ...rest}) => {
  const { appTheme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [text, setText] = useState(rest.currentValue ?? "");
  const [displayResults, setDisplayResults] = useState(false);

  const getSuggestions = useCallback(_.debounce(async (q: string) => {
    let json;
    try {
      const response = await japi(
        'get',
        '/search-locations?q=' + encodeURIComponent(q),
      );
      json = response.json;
    } catch {
      setItems(null);
    }

    setItems(json);
    setLoading(false);
  }, 500), []);

  const onChangeTextDebounced = useCallback(async (q) => {
    onChangeText(q);
    setText(q);
    setLoading(true);
    setDisplayResults(true);
    getSuggestions(q);
  }, [getSuggestions]);

  const Item = useCallback(({text}) => {
    return (
      <Pressable onPress={() => {
        setDisplayResults(false);
        onChangeText(text);
        setText(text);
      }}>
        <DefaultText style={{padding: 15}}>{text}</DefaultText>
      </Pressable>
    );
  }, []);

  return (
    <>
      <DefaultTextInput
        autoFocus={true}
        placeholder="Type a location..."
        value={text}
        onChangeText={onChangeTextDebounced}
      />
      <View
        style={{
          marginTop: 5,
          marginLeft: 20,
          marginRight: 20,
          paddingTop: 5,
          paddingBottom: 5,
        }}
      >
        {displayResults &&
          <View
            style={{
              position: 'absolute',
              width: '100%',
              top: 0,
              borderRadius: 10,
              backgroundColor: appTheme.primaryColor,
              maxHeight: Dimensions.get('screen').height * 0.25,
              borderWidth: 1,
              borderColor: appTheme.interactiveBorderColor,
              zIndex: 999,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={!loading}>
              {loading &&
                <ActivityIndicator
                  size="large"
                  color={appTheme.brandColor}
                  style={{ padding: 5 }}
                />
              }
              {!loading && items &&
                items.map((item) => <Item key={item} text={item}/>)
              }
              {!loading && !items?.length &&
                <DefaultText style={{ padding: 15, textAlign: 'center'}} >
                  No results
                </DefaultText>
              }
            </ScrollView>
          </View>
        }
      </View>
    </>
  );
};

export {
  LocationSelector,
};
