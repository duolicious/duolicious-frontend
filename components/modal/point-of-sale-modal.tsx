import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { DefaultText } from '../default-text';
import { DefaultModal } from './default-modal';
import { backgroundColors } from './background-colors';
import { ButtonWithCenteredText } from '../button/centered-text';
import { Logo14 } from '../logo';
import { Close } from '../button/close';
import Purchases, { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import * as _ from 'lodash';
import { AppStoreBadges } from '../badges/app-store';
import { listen, notify } from '../../events/events';

// TODO: Products should come from revenue cat
// TODO: On web, Revenuecat only supports Stripe. Redirect web users to mobile app
// TODO: Features need icons
// TODO: If users are presented with the modal upon attempting an action, the copy should probably be 'please support duolicious before doing that'
// TODO: Close button
// TODO: What if there's more than one offering?
// TODO: Wire up purchase logic
//
// You’re gonna need {currentPackage.product.title} for that...

const cardPadding = 20;

type Referer = 'blocked' | 'inquiry' | false;

const showPointOfSale = (reason: Referer) => {
  notify<Referer>('show-point-of-sale', reason);
};

const useShowPointOfSale = () => {
  const [referer, setReferer] = useState<Referer>(false);

  useEffect(() => {
    return listen<Referer>(
      'show-point-of-sale',
      (x) => x !== undefined && setReferer(x)
    );
  }, []);

  return referer;
};

const PurchaseButton = ({ label }: { label: string }) => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return (
      <ButtonWithCenteredText
        onPress={() => {}}
        textStyle={{
          fontWeight: 700,
        }}
        containerStyle={{
          marginTop: 0,
          marginBottom: 0,
        }}
        secondary={true}
      >
        {label}
      </ButtonWithCenteredText>
    );
  } else {
    return (
      <View
        style={{
          width: '100%',
          alignItems: 'center',
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: 500,
            maxWidth: 300,
          }}
        >
          Purchase via the mobile app to get these features on web
        </DefaultText>
        <View
          style={{
            maxWidth: 250,
          }}
        >
          <AppStoreBadges/>
        </View>
      </View>
    );
  }
};

const Offering = ({
  currentOffering,
  currentPackage,
  onPressClose,
  referer,
}: {
  currentOffering: PurchasesOffering | null | undefined,
  currentPackage: PurchasesPackage | null | undefined
  onPressClose: () => void,
  referer: Referer
}) => {
  if (!currentOffering || !currentPackage) {
    return (
      <>
        <View
          style={{
            width: 100,
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#70f"/>
        </View>
        <Close onPress={onPressClose} />
      </>
    );
  }

  const buttonCta =
    currentPackage.product.introPrice ?
      `Try ${currentPackage.product.introPrice.periodNumberOfUnits} ${_.capitalize(currentPackage.product.introPrice.periodUnit)}s Free` :
      `Get ${currentPackage.product.title.toUpperCase()}`;


  const subtitle =
    referer === 'blocked'
      ? `You’re gonna need ${currentPackage?.product.title} for that...`
      : 'Please support Duolicious 🥺 👉👈'

  return (
    <>
      <View
        style={{
          gap: 10,
        }}
      >
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Logo14 size={14 * 2} color="black" rectSize={0.3} />
            <DefaultText
              style={{
                fontFamily: 'TruenoBold',
                fontSize: 16,
              }}
            >
              Duolicious
            </DefaultText>
          </View>
          <DefaultText
            style={{
              fontSize: 42,
              fontWeight: 900,
              textAlign: 'center',
            }}
          >
            {currentPackage.product.title.toUpperCase()}
          </DefaultText>
        </View>
        <DefaultText
          style={{
            textAlign: 'center',
          }}
        >
          {subtitle}
        </DefaultText>
      </View>
      <View
        style={{
          backgroundColor: '#70f',
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 3,
        }}
      >
        <View
          style={{
            margin: cardPadding,
            gap: 8,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -cardPadding,
              right: 0,
            }}
          >
            <Logo14
              size={80}
              color="#ffd700"
            />
          </View>
          <DefaultText
            style={{
              fontWeight: 900,
              fontSize: 28,
              color: '#ffd700',
            }}
          >
            {currentPackage.product.title.toUpperCase()}
          </DefaultText>

          <DefaultText
            style={{
              color: 'white',
            }}
          >
            <DefaultText
              style={{
                fontWeight: 700,
              }}
            >
              {currentPackage.product.currencyCode} {currentPackage.product.price}
            </DefaultText>
            {} / {currentPackage.packageType.toLowerCase().replace(/ly$/, '')}
          </DefaultText>

          <DefaultText
            style={{
              color: '#70f',
              fontWeight: 700,
              fontSize: 12,
              paddingHorizontal: 7,
              paddingVertical: 3,
              backgroundColor: 'white',
              borderRadius: 999,
              alignSelf: 'flex-start',
            }}
          >
            FREE TRIAL
          </DefaultText>

          <DefaultText
            style={{
              color: 'white',
              paddingVertical: 14,
            }}
          >
            {String(currentOffering.metadata.description)}
          </DefaultText>

          <PurchaseButton label={buttonCta} />
        </View>

        <DefaultText
          style={{
            fontSize: 12,
            color: 'white',
            backgroundColor: 'black',
            paddingHorizontal: cardPadding,
            paddingVertical: cardPadding / 2,
          }}
        >
          Subscription renews automatically. Cancel anytime.
        </DefaultText>
      </View>
      <Close onPress={onPressClose} />
    </>
  );
};

const PointOfSaleModal = () => {
  const referer = useShowPointOfSale();
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>();

  const onPressClose = useCallback(() => showPointOfSale(false), []);

  useEffect(() => {
    (async () => {
      const offerings = await Purchases.getOfferings();
      console.log(offerings); // TODO
      setCurrentOffering(offerings.current);
    })();
  }, []);

  console.log(currentOffering); // TODO

  const currentPackage = currentOffering?.availablePackages.at(0);

  return (
    <DefaultModal
      transparent={true}
      visible={referer !== false}
      onRequestClose={onPressClose}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          padding: 10,
          ...backgroundColors.dark,
        }}
      >
        <View
          style={{
            maxWidth: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              maxWidth: 600,
              padding: 20,
              gap: 20,
              backgroundColor: 'white',
              borderRadius: 5,
              flexDirection: 'column',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Offering
              currentOffering={currentOffering}
              currentPackage={currentPackage}
              onPressClose={onPressClose}
              referer={referer}
            />
          </View>
        </View>
      </View>
    </DefaultModal>
  );
};

export {
  showPointOfSale,
  PointOfSaleModal,
};
