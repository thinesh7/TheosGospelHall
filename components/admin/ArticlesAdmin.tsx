import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';
import { addArticle, Article, ArticleInput, ArticleStatus, deleteArticle, subscribeArticles, updateArticle } from '../../utils/articles';
import { buildArticleMarkdownStyles } from '../../utils/articleMarkdownStyles';
import { THEMES } from '../../utils/theme';

const EMPTY_ARTICLE: ArticleInput = {
  title: '',
  subtitle: '',
  author: '',
  status: 'draft',
  bodyMarkdown: '',
};

const previewMarkdownStyles = buildArticleMarkdownStyles(THEMES.light, 15);

const ArticlesAdmin = forwardRef<AdminScreenHandle, {}>((_, ref) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<ArticleStatus>('draft');
  const [form, setForm] = useState<ArticleInput>(EMPTY_ARTICLE);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (showForm) { setShowForm(false); return true; }
      return false;
    },
  }));

  useEffect(() => {
    const unsubscribe = subscribeArticles(setArticles);
    return unsubscribe;
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setPreviousStatus('draft');
    setForm(EMPTY_ARTICLE);
    setShowPreview(false);
    setShowForm(true);
  };

  const openEditForm = (article: Article) => {
    setEditingId(article.id);
    setPreviousStatus(article.status);
    setForm({
      title: article.title,
      subtitle: article.subtitle,
      author: article.author,
      status: article.status,
      bodyMarkdown: article.bodyMarkdown,
    });
    setShowPreview(false);
    setShowForm(true);
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
        await addArticle(payload);
      }
      setShowForm(false);
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

  const previewMarkdown = useMemo(() => form.bodyMarkdown || '_Nothing written yet._', [form.bodyMarkdown]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {!showForm ? (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
            <Text style={styles.addBtnText}>＋ Add Article</Text>
          </TouchableOpacity>
          {articles.length === 0 ? (
            <Text style={styles.emptyText}>No articles yet. Tap above to add one.</Text>
          ) : (
            articles.map(article => (
              <View key={article.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{article.title}</Text>
                    {!!article.author && <Text style={styles.cardMeta}>by {article.author}</Text>}
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
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
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
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
});

export default ArticlesAdmin;

const styles = StyleSheet.create({
  addBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 30, fontSize: 14, fontStyle: 'italic' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0f3460' },
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
