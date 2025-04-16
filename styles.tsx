import { StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  primaryEnlargeableImageBigScreen: {
    overflow: 'hidden',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  secondaryEnlargeableImage: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
  },
  secondaryEnlargeableImageInner: {
  },
  cardBorders: {
    borderRadius: 10,

    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 3,

    borderTopColor: '#eee',
    borderLeftColor: '#ddd',
    borderRightColor: '#ddd',
    borderBottomColor: '#ddd',
  },
});

export {
  commonStyles,
};
