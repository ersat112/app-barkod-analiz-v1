import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ProductSummaryCardProps = {
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  fallbackIconName?: keyof typeof Ionicons.glyphMap;
  eyebrow?: string | null;
  title: string;
  meta?: string | null;
  supportingText?: string | null;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  activeOpacity?: number;
  alignItems?: 'center' | 'flex-start';
  imageSize?: number;
  imageRadius?: number;
  eyebrowColor: string;
  titleColor: string;
  metaColor: string;
  supportingColor: string;
  imageBackgroundColor: string;
  fallbackIconColor: string;
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleNumberOfLines?: number;
  metaNumberOfLines?: number;
  supportingNumberOfLines?: number;
  eyebrowStyle?: StyleProp<TextStyle>;
  titleStyle?: StyleProp<TextStyle>;
  metaStyle?: StyleProp<TextStyle>;
  supportingStyle?: StyleProp<TextStyle>;
};

export const ProductSummaryCard: React.FC<ProductSummaryCardProps> = ({
  imageUrl,
  fallbackImageUrl,
  fallbackIconName = 'cube-outline',
  eyebrow,
  title,
  meta,
  supportingText,
  trailing,
  onPress,
  disabled = false,
  activeOpacity = 0.9,
  alignItems = 'center',
  imageSize = 66,
  imageRadius = 18,
  eyebrowColor,
  titleColor,
  metaColor,
  supportingColor,
  imageBackgroundColor,
  fallbackIconColor,
  containerStyle,
  contentStyle,
  titleNumberOfLines = 2,
  metaNumberOfLines = 2,
  supportingNumberOfLines = 2,
  eyebrowStyle,
  titleStyle,
  metaStyle,
  supportingStyle,
}) => {
  const resolvedImageUri = imageUrl || fallbackImageUrl;

  const content = (
    <View style={[styles.row, { alignItems }, contentStyle]}>
      {resolvedImageUri ? (
        <Image
          source={{ uri: resolvedImageUri }}
          style={[
            styles.image,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: imageRadius,
              backgroundColor: imageBackgroundColor,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.imageFallback,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: imageRadius,
              backgroundColor: imageBackgroundColor,
            },
          ]}
        >
          <Ionicons
            name={fallbackIconName}
            size={Math.max(18, Math.round(imageSize * 0.34))}
            color={fallbackIconColor}
          />
        </View>
      )}

      <View style={styles.textWrap}>
        {eyebrow ? (
          <Text
            style={[styles.eyebrow, { color: eyebrowColor }, eyebrowStyle]}
            numberOfLines={1}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={[styles.title, { color: titleColor }, titleStyle]}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            style={[styles.meta, { color: metaColor }, metaStyle]}
            numberOfLines={metaNumberOfLines}
          >
            {meta}
          </Text>
        ) : null}
        {supportingText ? (
          <Text
            style={[styles.supportingText, { color: supportingColor }, supportingStyle]}
            numberOfLines={supportingNumberOfLines}
          >
            {supportingText}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailingWrap}>{trailing}</View> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        disabled={disabled}
        style={containerStyle}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    flexShrink: 0,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  supportingText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  trailingWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});
