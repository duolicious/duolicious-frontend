import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DefaultText } from './default-text';
import { friendlyDate } from '../util/util';

type Props = {
  timestamp: Date;
};

const MessageDivider = ({ timestamp }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.lineContainer}>
        <View style={styles.line} />
        <DefaultText style={styles.text}>{friendlyDate(timestamp)}</DefaultText>
        <View style={styles.line} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    width: '100%',
  },
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#4f545c',
  },
  text: {
    fontSize: 12,
    color: 'black',
    fontWeight: '600',
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
});

export MessageDivider;