import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

// Core Services & Context
import { getAllHistory, deleteHistoryItem } from '../../services/db';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

/**
 * Geçmiş verilerini Tarih (Bugün, Dün, Geçmiş) bazlı gruplandıran yardımcı fonksiyon.
 */
const groupHistoryByDate = (data: any[], t: any) => {
  const sections: any[] = [];
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const groups = data.reduce((acc: any, item: any) => {
    const date = item.created_at.split(' ')[0];
    let title = date;
    
    if (date === today) title = t('today');
    else if (date === yesterday) title = t('yesterday');
    
    if (!acc[title]) acc[title] = [];
    acc[title].push(item);
    return acc;
  }, {});

  Object.keys(groups).forEach(key => {
    sections.push({ title: key, data: groups[key] });
  });

  return sections;
};

export const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Ekran her odaklandığında SQLite'dan güncel veriyi çek.
   * useFocusEffect, Tab bar geçişlerinde verinin güncelliğini sağlar.
   */
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = () => {
    try {
      const data = getAllHistory(); // SQLite'dan tüm veriyi çek
      const groupedData = groupHistoryByDate(data, t);
      setSections(groupedData);
    } catch (error) {
      console.error("Load History Error:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bir öğeyi silme algoritması
   */
  const handleDelete = (barcode: string) => {
    Alert.alert(t('delete_title'), t('delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('delete'), 
        style: 'destructive',
        onPress: () => {
          deleteHistoryItem(barcode);
          loadHistory(); // Listeyi yenile
        }
      }
    ]);
  };

  /**
   * Silme işlemi için sağdan çıkan kırmızı buton (Swipe Action)
   */
  const renderRightActions = (barcode: string) => (
    <TouchableOpacity 
      style={styles.deleteAction} 
      onPress={() => handleDelete(barcode)}
    >
      <Ionicons name="trash-outline" size={28} color="#FFF" />
    </TouchableOpacity>
  );

  /**
   * Geçmiş Öğe Kartı
   */
  const renderItem = ({ item }: { item: any }) => (
    <GestureHandlerRootView>
      <Swipeable renderRightActions={() => renderRightActions(item.barcode)}>
        <TouchableOpacity 
          style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Detail', { barcode: item.barcode })}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.image_url || 'https://via.placeholder.com/100' }} style={styles.itemImage} />
          
          <View style={styles.itemDetails}>
            <Text style={[styles.itemBrand, { color: colors.primary }]}>{item.brand}</Text>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            
            <View style={styles.itemFooter}>
              <View style={[styles.scoreBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.scoreText, { color: colors.primary }]}>Skor: {item.score}</Text>
              </View>
              <Text style={[styles.timeText, { color: colors.text }]}>
                {item.created_at.split(' ')[1].substring(0, 5)}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={colors.border} />
        </TouchableOpacity>
      </Swipeable>
    </GestureHandlerRootView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('history')}</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.barcode + index}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={80} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.text }]}>{t('history_empty')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 25, marginBottom: 15 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  listContent: { paddingHorizontal: 25, paddingBottom: 100 },
  sectionHeader: { paddingVertical: 12, marginTop: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.5, letterSpacing: 1 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
  },
  itemImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#FFF' },
  itemDetails: { flex: 1, marginLeft: 15 },
  itemBrand: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  itemName: { fontSize: 16, fontWeight: '700', marginVertical: 2 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreText: { fontSize: 11, fontWeight: 'bold' },
  timeText: { fontSize: 11, opacity: 0.5 },
  deleteAction: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '85%', // Kart ile aynı hizada olması için
    borderRadius: 18,
    marginLeft: 10,
  },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 20, fontSize: 16, opacity: 0.4, fontWeight: '600' }
});