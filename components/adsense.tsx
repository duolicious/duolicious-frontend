import { useEffect } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { DefaultText } from './default-text';

const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const ADSENSE_CLIENT = 'ca-pub-2356864342428722';
const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

const AdSensePlaceholder = ({
  slot,
  style,
}: {
  slot: string
  style?: StyleProp<ViewStyle>
}) => (
  <View
    style={[
      {
        width: 300,
        height: 250,
        borderWidth: 1,
        borderColor: '#ccc',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
  >
    <DefaultText style={{ color: '#999' }}>
      Ad placeholder (slot {slot})
    </DefaultText>
  </View>
);

const AdSenseUnit = ({
  slot,
  style,
  format,
  fullWidthResponsive,
  placeholderStyle,
}: {
  slot: string
  style?: any
  format?: string
  fullWidthResponsive?: boolean
  placeholderStyle?: StyleProp<ViewStyle>
}) => {
  useEffect(() => {
    if (Platform.OS !== 'web' || IS_LOCALHOST) {
      return;
    }

    if (!document.querySelector(`script[src="${ADSENSE_SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = ADSENSE_SCRIPT_SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
    }
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (IS_LOCALHOST) {
    return <AdSensePlaceholder slot={slot} style={placeholderStyle}/>;
  }

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? 'true' : undefined}
    />
  );
};

export {
  AdSenseUnit,
  IS_LOCALHOST,
};
