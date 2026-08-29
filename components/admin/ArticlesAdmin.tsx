import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import Markdown from 'react-native-markdown-display';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';
import {
  addArticle,
  addCategory,
  Article,
  ArticleCategoryEntry,
  ArticleInput,
  ArticleStatus,
  deleteArticle,
  deleteCategory,
  renameCategory,
  reorderArticles,
  subscribeArticles,
  subscribeCategories,
  updateArticle,
} from '../../utils/articles';
import { buildArticleMarkdownStyles } from '../../utils/articleMarkdownStyles';
import { THEMES } from '../../utils/theme';

const EMPTY_ARTICLE: ArticleInput = {
  title: '',
  subtitle: '',
  author: '',
  category: '',
  status: 'draft',
  bodyMarkdown: '',
};

const previewMarkdownStyles = buildArticleMarkdownStyles(THEMES.light, 15);

type ArticlesView = 'list' | 'form' | 'categories';

const ArticlesAdmin = forwardRef<AdminScreenHandle, {}>((_, ref) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategoryEntry[]>([]);
  const [view, setView] = useState<ArticlesView>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<ArticleStatus>('draft');
  const [form, setForm] = useState<ArticleInput>(EMPTY_ARTICLE);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (view !== 'list') { setView('list'); return true; }
      return false;
    },
  }));

  useEffect(() => {
    const unsubscribe = subscribeArticles(setArticles);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCategories(setCategories);
    return unsubscribe;
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setPreviousStatus('draft');
    setForm({ ...EMPTY_ARTICLE, category: categories[0]?.name ?? '' });
    setShowPreview(false);
    setView('form');
  };

  const openEditForm = (article: Article) => {
    setEditingId(article.id);
    setPreviousStatus(article.status);
    setForm({
      title: article.title,
      subtitle: article.subtitle,
      author: article.author,
      category: article.category || categories[0]?.name || '',
      status: article.status,
      bodyMarkdown: article.bodyMarkdown,
    });
    setShowPreview(false);
    setView('form');
  };

  const F = <K extends keyof ArticleInput>(field: K, val: ArticleInput[K]) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const saveArticle = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!form.bodyMarkdown.trim()) { Alert.alert('Required', 'Please write the article body.'); return; }

    setSaving(true);
    try {
      const payload: ArticleInput = { ...form, title: form.title.trim() };
      if (editingId) {
        await updateArticle(editingId, payload, previousStatus);
      } else {
        // New articles land at the end of the list; use the reorder
        // arrows afterward to move them up. Legacy articles that predate
        // ordering carry a placeholder order value — ignore those when
        // computing "the end" so this can't overflow past them.
        const finiteOrders = articles.map(a => a.order).filter(o => o < Number.MAX_SAFE_INTEGER);
        const nextOrder = finiteOrders.length > 0 ? Math.max(...finiteOrders) + 1 : articles.length;
        await addArticle(payload, nextOrder);
      }
      setView('list');
      Alert.alert('✅ Saved', editingId ? 'Article updated.' : 'Article added.');
    } catch (e) {
      Alert.alert('Error', 'Could not save the article. Check your internet connection.');
    }
    setSaving(false);
  };

  const removeArticle = (article: Article) => {
    Alert.alert('Delete Article', `Delete "${article.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteArticle(article.id);
          } catch {
            Alert.alert('Error', 'Could not delete the article.');
          }
        },
      },
    ]);
  };

  const submitNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Already exists', `"${trimmed}" is already a category.`);
      return;
    }
    try {
      await addCategory(trimmed);
      setNewCategoryName('');
    } catch {
      Alert.alert('Error', 'Could not add the category.');
    }
  };

  const startEditingCategory = (category: ArticleCategoryEntry) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const saveEditedCategory = async () => {
    if (!editingCategoryId) return;
    const trimmed = editingCategoryName.trim();
    if (!trimmed) return;
    try {
      await renameCategory(editingCategoryId, trimmed);
      setEditingCategoryId(null);
    } catch {
      Alert.alert('Error', 'Could not rename the category.');
    }
  };

  const removeCategory = (category: ArticleCategoryEntry) => {
    const usedByCount = articles.filter(a => a.category === category.name).length;
    const message = usedByCount > 0
      ? `${usedByCount} article${usedByCount === 1 ? '' : 's'} currently use "${category.name}". They will keep showing under "All Articles" but won't match any category filter anymore. Delete anyway?`
      : `Delete "${category.name}"?`;
    Alert.alert('Delete Category', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(category.id);
          } catch {
            Alert.alert('Error', 'Could not delete the category.');
          }
        },
      },
    ]);
  };

  const previewMarkdown = useMemo(() => form.bodyMarkdown || '_Nothing written yet._', [form.bodyMarkdown]);

  // `articles` is already in display order (subscribeArticles sorts by
  // `order`) — DraggableFlatList hands back the whole list in its new
  // order on drop, and reorderArticles re-numbers every article by its
  // position in that list in one atomic write.
  const handleDragEnd = async (data: Article[]) => {
    try {
      await reorderArticles(data.map(a => a.id));
    } catch {
      Alert.alert('Error', 'Could not reorder articles.');
    }
  };

  const renderArticleItem = ({ item: article, drag, isActive }: RenderItemParams<Article>) => (
    <ScaleDecorator>
      <View style={styles.cardRow}>
        <TouchableOpacity onPressIn={drag} disabled={isActive} style={styles.dragHandle} hitSlop={8}>
          <Text style={styles.dragHandleText}>☰</Text>
        </TouchableOpacity>

        <View style={[styles.card, isActive && styles.cardActive]}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{article.title}</Text>
              {!!article.author && <Text style={styles.cardMeta}>by {article.author}</Text>}
              {!!article.category && <Text style={styles.cardMeta}>{article.category}</Text>}
            </View>
            <View style={[styles.statusBadge, article.status === 'published' ? styles.statusPublished : styles.statusDraft]}>
              <Text style={[styles.statusBadgeText, article.status === 'published' ? styles.statusPublishedText : styles.statusDraftText]}>
                {article.status === 'published' ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(article)}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeArticle(article)}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScaleDecorator>
  );

  if (view === 'list') {
    return (
      <View style={styles.listScreen}>
        <View style={styles.listHeaderWrap}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
            <Text style={styles.addBtnText}>＋ Add Article</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoriesBtn} onPress={() => setView('categories')}>
            <Text style={styles.categoriesBtnText}>🏷 Manage Categories</Text>
          </TouchableOpacity>
          {articles.length > 0 && (
            <Text style={styles.dragHint}>Hold ☰ and drag to reorder — this is the order readers see.</Text>
          )}
        </View>
        {articles.length === 0 ? (
          <Text style={styles.emptyText}>No articles yet. Tap above to add one.</Text>
        ) : (
          <DraggableFlatList
            data={articles}
            keyExtractor={item => item.id}
            onDragEnd={({ data }) => handleDragEnd(data)}
            renderItem={renderArticleItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  if (view === 'categories') {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setView('list')}>
            <Text style={styles.formBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Manage Categories</Text>
        </View>

        <View style={styles.addCategoryRow}>
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="New category name"
            placeholderTextColor="#999"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            onSubmitEditing={submitNewCategory}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addCategoryBtn} onPress={submitNewCategory}>
            <Text style={styles.addCategoryBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <Text style={styles.emptyText}>No categories yet. Add one above.</Text>
        ) : (
          categories.map(category => (
            <View key={category.id} style={styles.categoryManageRow}>
              {editingCategoryId === category.id ? (
                <>
                  <TextInput
                    style={[styles.formInput, { flex: 1 }]}
                    value={editingCategoryName}
                    onChangeText={setEditingCategoryName}
                    onSubmitEditing={saveEditedCategory}
                    returnKeyType="done"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.categorySaveBtn} onPress={saveEditedCategory}>
                    <Text style={styles.categorySaveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.categoryCancelBtn} onPress={() => setEditingCategoryId(null)}>
                    <Text style={styles.categoryCancelBtnText}>✕</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.categoryManageName}>{category.name}</Text>
                  <TouchableOpacity style={styles.categoryEditBtn} onPress={() => startEditingCategory(category)}>
                    <Text style={styles.categoryEditBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.categoryDeleteBtn} onPress={() => removeCategory(category)}>
                    <Text style={styles.categoryDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => setView('list')}>
          <Text style={styles.formBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{editingId ? 'Edit Article' : 'New Article'}</Text>
      </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Title *</Text>
            <TextInput style={styles.formInput} placeholder="Article title" placeholderTextColor="#999" value={form.title} onChangeText={v => F('title', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Subtitle</Text>
            <TextInput style={styles.formInput} placeholder="Short one-line summary (shown in the list)" placeholderTextColor="#999" value={form.subtitle} onChangeText={v => F('subtitle', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Author</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Pastor Name" placeholderTextColor="#999" value={form.author} onChangeText={v => F('author', v)} />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Category</Text>
            {categories.length === 0 ? (
              <Text style={styles.toggleHint}>No categories yet — add one from "🏷 Manage Categories" first.</Text>
            ) : (
              <View style={styles.categoryRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, form.category === cat.name && styles.categoryChipSelected]}
                    onPress={() => F('category', cat.name)}
                  >
                    <Text style={[styles.categoryChipText, form.category === cat.name && styles.categoryChipTextSelected]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.formField}>
            <View style={styles.bodyLabelRow}>
              <Text style={styles.formLabel}>Body (Markdown) *</Text>
              <TouchableOpacity onPress={() => setShowPreview(p => !p)}>
                <Text style={styles.previewToggle}>{showPreview ? 'Edit' : 'Preview'}</Text>
              </TouchableOpacity>
            </View>
            {showPreview ? (
              <View style={styles.previewBox}>
                <Markdown style={previewMarkdownStyles}>{previewMarkdown}</Markdown>
              </View>
            ) : (
              <TextInput
                style={[styles.formInput, styles.formInputBody]}
                placeholder={'Write using Markdown, e.g.\n\n# Heading\n\nSome **bold** text and a [link](https://example.com).'}
                placeholderTextColor="#999"
                value={form.bodyMarkdown}
                onChangeText={v => F('bodyMarkdown', v)}
                multiline
                textAlignVertical="top"
              />
            )}
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.formLabel}>Published</Text>
              <Text style={styles.toggleHint}>{form.status === 'published' ? 'Visible to all users' : 'Only visible to admins'}</Text>
            </View>
            <Switch
              value={form.status === 'published'}
              onValueChange={v => F('status', v ? 'published' : 'draft')}
              trackColor={{ true: '#0f3460', false: '#ccc' }}
            />
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveArticle} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? '💾 Update Article' : '💾 Add Article'}</Text>
          </TouchableOpacity>
      <TouchableOpacity onPress={() => setView('list')} style={styles.cancelBtn}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
});

export default ArticlesAdmin;

const styles = StyleSheet.create({
  addBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  categoriesBtn: { backgroundColor: '#eef1f5', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 8 },
  categoriesBtnText: { color: '#0f3460', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 30, fontSize: 14, fontStyle: 'italic' },
  listScreen: { flex: 1 },
  listHeaderWrap: { padding: 16, paddingBottom: 8 },
  listContent: { padding: 16, paddingTop: 8 },
  dragHint: { textAlign: 'center', color: '#888', fontSize: 12, fontStyle: 'italic' },
  cardRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 12 },
  dragHandle: { width: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef1f5', borderRadius: 10 },
  dragHandleText: { color: '#0f3460', fontSize: 18 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0f3460' },
  cardActive: { elevation: 8, borderLeftColor: '#1a6b3a' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#666' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusPublished: { backgroundColor: '#e6f4ea' },
  statusDraft: { backgroundColor: '#f0f0f0' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusPublishedText: { color: '#1a6b3a' },
  statusDraftText: { color: '#777' },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 10, padding: 10, alignItems: 'center' },
  editBtnText: { color: '#0f3460', fontWeight: '600', fontSize: 13 },
  deleteBtn: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, alignItems: 'center', width: 44 },
  deleteBtnText: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  formBackText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e' },
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, borderColor: '#eee', color: '#1a1a2e' },
  formInputBody: { minHeight: 220, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eef1f5' },
  categoryChipSelected: { backgroundColor: '#0f3460' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  categoryChipTextSelected: { color: '#fff' },
  addCategoryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  addCategoryBtn: { backgroundColor: '#0f3460', borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addCategoryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  categoryManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  categoryManageName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  categoryEditBtn: { padding: 8 },
  categoryEditBtnText: { fontSize: 15 },
  categoryDeleteBtn: { backgroundColor: '#fdecea', borderRadius: 8, padding: 8 },
  categoryDeleteBtnText: { fontSize: 14 },
  categorySaveBtn: { backgroundColor: '#0f3460', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  categorySaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  categoryCancelBtn: { padding: 8 },
  categoryCancelBtnText: { fontSize: 16, color: '#888' },
  bodyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  previewToggle: { color: '#0f3460', fontWeight: '700', fontSize: 13 },
  previewBox: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee', minHeight: 220 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 20, elevation: 2 },
  toggleHint: { fontSize: 12, color: '#888', marginTop: 2 },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { alignItems: 'center', padding: 12, marginBottom: 20 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
