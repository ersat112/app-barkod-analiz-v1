import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '../../context/ThemeContext';
import { withAlpha } from '../../utils/color';

type SelectionFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  colors: ThemeColors;
  isDark: boolean;
  helperText?: string;
  disabled?: boolean;
};

type SearchableSelectSheetProps = {
  visible: boolean;
  title: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: string[];
  selectedValue?: string | null;
  emptyText: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  colors: ThemeColors;
  isDark: boolean;
  loading?: boolean;
  loadingText?: string;
};

export const SelectionField: React.FC<SelectionFieldProps> = ({
  label,
  value,
  placeholder,
  onPress,
  colors,
  isDark,
  helperText,
  disabled = false,
}) => {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.fieldButton,
          {
            borderColor: withAlpha(colors.border, 'CC'),
            backgroundColor: disabled
              ? withAlpha(colors.backgroundMuted, isDark ? '72' : 'C8')
              : withAlpha(colors.backgroundMuted, isDark ? 'D6' : 'F4'),
            opacity: disabled ? 0.76 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.86}
      >
        <Text
          style={[
            styles.fieldValue,
            {
              color: value ? colors.text : withAlpha(colors.text, '66'),
            },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.text} />
      </TouchableOpacity>
      {helperText ? (
        <Text style={[styles.fieldHelper, { color: colors.mutedText }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

export const SearchableSelectSheet: React.FC<SearchableSelectSheetProps> = ({
  visible,
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  items,
  selectedValue,
  emptyText,
  onSelect,
  onClose,
  colors,
  isDark,
  loading = false,
  loadingText,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: withAlpha(colors.cardElevated, isDark ? 'F4' : 'FC'),
              borderColor: withAlpha(colors.border, 'B8'),
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: withAlpha(colors.backgroundMuted, isDark ? '9C' : 'F2'),
                  borderColor: withAlpha(colors.border, 'B8'),
                },
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Ionicons name="close-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBox,
              {
                borderColor: withAlpha(colors.border, 'CC'),
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'CA' : 'F5'),
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.mutedText} />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={withAlpha(colors.text, '66')}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedText }]}>
                {loadingText || ''}
              </Text>
            </View>
          ) : null}

          {!loading && !items.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={24} color={colors.mutedText} />
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>{emptyText}</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selectedValue === item;

                return (
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      {
                        borderColor: withAlpha(colors.border, 'A8'),
                        backgroundColor: isSelected
                          ? withAlpha(colors.primary, '12')
                          : withAlpha(colors.backgroundMuted, isDark ? 'A0' : 'E8'),
                      },
                    ]}
                    onPress={() => onSelect(item)}
                    activeOpacity={0.86}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fieldGroup: {
    width: '100%',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  fieldButton: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fieldValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldHelper: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    minHeight: '58%',
    maxHeight: '78%',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: -10,
    },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  list: {
    marginTop: 16,
  },
  optionButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
});
