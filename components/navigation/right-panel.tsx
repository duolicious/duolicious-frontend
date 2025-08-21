import { useCallback } from 'react';
import { View } from 'react-native';
import { DefaultText } from '../default-text';
import { ButtonWithCenteredText } from '../button/centered-text';
import { showPointOfSale } from '../modal/point-of-sale-modal';

const RightPanel = () => {
  const onPress = useCallback(() => {
    showPointOfSale('inquiry');
  }, []);

  return (
    <View
      style={{
        maxWidth: 360,
        padding: 20,
      }}
    >
      <View
        style={{
          borderRadius: 10,
          backgroundColor: '#70f',
          width: '100%',
          padding: 20,
          gap: 20,
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            fontWeight: '900',
            fontSize: 22,
            textAlign: 'center',
          }}
        >
          Support Duolicious
        </DefaultText>

        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            backgroundColor: 'black',
            borderRadius: 10,
            padding: 10,
          }}
        >
          Want more messages from more attractive people?? Well, you’re on the
          wrong app! But at least you can get barely-any-good-messages in
          comfort and style, with {}
          <DefaultText style={{ fontWeight: 700 }}>
            Duolicious GOLD
          </DefaultText>
          .
          {'\n\n'}
          That’s right! With Duolicious GOLD, you get a bunch of perks for a
          price so low our payment processor almost wouldn’t let us charge it!
          Plus it gives us the money to keep this Sisyphean shit show on the
          road!
          {'\n\n'}
          (Please. We need money. They're gonna take our thumbs.)
          {'\n\n'}
          Kisses! 🤗
        </DefaultText>

        <ButtonWithCenteredText
          onPress={onPress}
          textStyle={{
            fontWeight: '700',
          }}
          containerStyle={{
            marginTop: 0,
            marginBottom: 0,
          }}
          secondary={true}
        >
          Get GOLD
        </ButtonWithCenteredText>
      </View>
    </View>
  );
};

export {
  RightPanel,
};
