import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../auth/AuthContext';
import { useSchool } from '../school/SchoolContext';
import { classMediaApi, GalleryItem, GallerySection } from '../api/client';

type Kind = 'photo' | 'document';
type Upload = { name: string; status: 'waiting' | 'uploading' | 'done' | string };

const today = () => new Date().toISOString().slice(0, 10);
const sectionLabel = (s: GallerySection) =>
  `${s.grade_name} ${s.section_name}${s.is_current_year ? '' : ` (${s.academic_year})`}`;
const sizeLabel = (b: number) => (b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
];

/**
 * Class gallery (event photos) and class documents. Teachers add files for
 * their own class, admins for any class; parents see their child's class.
 * The server enforces all of this; the screen only hides what can't be done.
 */
export default function GalleryScreen() {
  const { user } = useAuth();
  const { currentSchool } = useSchool();
  const isParent = user?.role === 'parent';
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 32 - 8) / 3);

  const [sections, setSections] = useState<GallerySection[]>([]);
  const [storageReady, setStorageReady] = useState(true);
  const [sectionId, setSectionId] = useState('');
  const [kind, setKind] = useState<Kind>('photo');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState(-1);
  const [event, setEvent] = useState('');
  const [date, setDate] = useState(today());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const busy = uploads.some(u => u.status === 'waiting' || u.status === 'uploading');

  useEffect(() => {
    if (user?.role === 'super_admin' && !currentSchool) return;
    classMediaApi
      .sections(user?.role === 'super_admin' ? currentSchool?.id : undefined)
      .then(res => {
        setSections(res.items || []);
        setStorageReady(res.storage_ready !== false);
        setSectionId(prev => (prev && res.items.some(s => s.id === prev) ? prev : res.items[0]?.id || ''));
        if (!res.items.length) setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [user?.role, currentSchool]);

  const load = useCallback(() => {
    if (!sectionId) return Promise.resolve();
    setError('');
    return classMediaApi
      .list(sectionId, kind)
      .then(res => {
        setItems(res.items || []);
        setCanUpload(!!res.can_upload);
      })
      .catch(e => {
        setItems([]);
        setError(e.message);
      });
  }, [sectionId, kind]);

  useEffect(() => {
    if (!sectionId) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [sectionId, kind, load]);

  const groups = useMemo(() => {
    const out: { key: string; event: string; date?: string; items: GalleryItem[] }[] = [];
    for (const it of items) {
      const key = `${it.event}|${it.event_date || ''}`;
      let g = out.find(x => x.key === key);
      if (!g) {
        g = { key, event: it.event, date: it.event_date, items: [] };
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [items]);
  const photos = kind === 'photo' ? items : [];

  async function uploadAll(files: { uri: string; name: string; type: string }[]) {
    if (!files.length) return;
    setUploads(files.map(f => ({ name: f.name, status: 'waiting' })));
    for (let i = 0; i < files.length; i++) {
      setUploads(u => u.map((x, j) => (j === i ? { ...x, status: 'uploading' } : x)));
      try {
        await classMediaApi.upload(sectionId, kind, files[i], event.trim(), /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '');
        setUploads(u => u.map((x, j) => (j === i ? { ...x, status: 'done' } : x)));
      } catch (e: any) {
        setUploads(u => u.map((x, j) => (j === i ? { ...x, status: e.message || 'Failed' } : x)));
      }
    }
    load();
  }

  async function pickPhotos(fromCamera: boolean) {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Camera', 'Allow camera access in Settings to take photos.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 20 });
    if (res.canceled) return;
    uploadAll(
      res.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}-${i}.jpg`,
        type: a.mimeType || 'image/jpeg',
      })),
    );
  }

  async function pickDocuments() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, type: DOC_TYPES, copyToCacheDirectory: true });
    if (res.canceled) return;
    uploadAll(res.assets.map(a => ({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream' })));
  }

  function confirmDelete(it: GalleryItem) {
    if (!it.can_delete) return;
    Alert.alert('Delete?', it.file_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await classMediaApi.remove(it.id);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          }
        },
      },
    ]);
  }

  if (loading && !sections.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  if (!sections.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="images-outline" size={40} color="#cbd5e1" />
        <Text style={styles.empty}>
          {error ||
            (isParent
              ? 'No class found for your child yet.'
              : user?.role === 'teacher'
                ? 'You are not the class teacher of any class yet.'
                : 'No classes yet.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {sections.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {sections.map(s => {
              const on = s.id === sectionId;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setSectionId(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{sectionLabel(s)}</Text>
                  {s.children ? <Text style={[styles.chipSub, on && styles.chipTextOn]}>{s.children}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {sections.length === 1 && (
          <Text style={styles.title}>
            {sectionLabel(sections[0])}
            {sections[0].children ? ` · ${sections[0].children}` : ''}
          </Text>
        )}

        <View style={styles.tabs}>
          {(['photo', 'document'] as Kind[]).map(k => (
            <TouchableOpacity
              key={k}
              style={[styles.tab, kind === k && styles.tabOn]}
              onPress={() => setKind(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === k }}
            >
              <Ionicons name={k === 'photo' ? 'images-outline' : 'document-text-outline'} size={16} color={kind === k ? '#4f46e5' : '#64748b'} />
              <Text style={[styles.tabText, kind === k && styles.tabTextOn]}>{k === 'photo' ? 'Photos' : 'Documents'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!storageReady && <Text style={styles.error}>File storage is not set up on the server yet.</Text>}

        {canUpload && storageReady && (
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              value={event}
              onChangeText={setEvent}
              placeholder={kind === 'photo' ? 'Event (e.g. Annual Day)' : 'Title (e.g. Timetable)'}
              maxLength={120}
              editable={!busy}
            />
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" editable={!busy} />
            <View style={styles.row}>
              {kind === 'photo' ? (
                <>
                  <TouchableOpacity style={[styles.btn, busy && styles.btnOff]} onPress={() => pickPhotos(false)} disabled={busy}>
                    <Ionicons name="images-outline" size={16} color="#fff" />
                    <Text style={styles.btnText}>Add photos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnOutline, busy && styles.btnOff]} onPress={() => pickPhotos(true)} disabled={busy}>
                    <Ionicons name="camera-outline" size={16} color="#4f46e5" />
                    <Text style={styles.btnOutlineText}>Camera</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.btn, busy && styles.btnOff]} onPress={pickDocuments} disabled={busy}>
                  <Ionicons name="document-attach-outline" size={16} color="#fff" />
                  <Text style={styles.btnText}>Add documents</Text>
                </TouchableOpacity>
              )}
            </View>
            {uploads.map((u, i) => (
              <View key={i} style={styles.upload}>
                <Text style={styles.uploadName} numberOfLines={1}>
                  {u.name}
                </Text>
                <Text
                  style={[
                    styles.uploadStatus,
                    u.status === 'done' && { color: '#16a34a' },
                    !['waiting', 'uploading', 'done'].includes(u.status) && { color: '#dc2626' },
                  ]}
                  numberOfLines={1}
                >
                  {u.status === 'waiting' ? 'Waiting' : u.status === 'uploading' ? 'Uploading…' : u.status === 'done' ? 'Uploaded' : u.status}
                </Text>
              </View>
            ))}
            {canUpload && items.some(i => i.can_delete) && <Text style={styles.hint}>Long-press a file to delete it.</Text>}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#4f46e5" style={{ marginTop: 24 }} /> : null}
        {!loading && !items.length && !error && (
          <Text style={styles.empty}>{kind === 'photo' ? 'No photos yet.' : 'No documents yet.'}</Text>
        )}

        {groups.map(g => (
          <View key={g.key} style={styles.group}>
            <Text style={styles.event}>
              {g.event || (kind === 'photo' ? 'Photos' : 'Documents')}
              {g.date ? <Text style={styles.date}>{`  ${g.date}`}</Text> : null}
            </Text>
            {kind === 'photo' ? (
              <View style={styles.grid}>
                {g.items.map(it => (
                  <TouchableOpacity
                    key={it.id}
                    onPress={() => setViewer(photos.indexOf(it))}
                    onLongPress={() => confirmDelete(it)}
                    accessibilityLabel={it.file_name}
                  >
                    {it.thumb_url || it.content_type !== 'image/heic' ? (
                      <Image source={{ uri: it.thumb_url || it.url }} style={{ width: tile, height: tile, borderRadius: 6, backgroundColor: '#e2e8f0' }} />
                    ) : (
                      <View style={[styles.heic, { width: tile, height: tile }]}>
                        <Ionicons name="image-outline" size={22} color="#94a3b8" />
                        <Text style={styles.heicText}>HEIC</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              g.items.map(it => (
                <TouchableOpacity
                  key={it.id}
                  style={styles.doc}
                  onPress={() => it.url && Linking.openURL(it.url)}
                  onLongPress={() => confirmDelete(it)}
                  accessibilityRole="link"
                >
                  <Ionicons name="document-text-outline" size={20} color="#4f46e5" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName} numberOfLines={2}>
                      {it.file_name}
                    </Text>
                    <Text style={styles.docMeta}>
                      {sizeLabel(it.size_bytes)}
                      {it.uploaded_by_name ? ` · ${it.uploaded_by_name}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color="#94a3b8" />
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={viewer >= 0 && !!photos[viewer]} transparent animationType="fade" onRequestClose={() => setViewer(-1)}>
        {viewer >= 0 && photos[viewer] && (
          <View style={styles.viewer}>
            <Image source={{ uri: photos[viewer].url }} style={styles.viewerImg} resizeMode="contain" />
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(-1)} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.viewerBar}>
              <TouchableOpacity disabled={viewer === 0} onPress={() => setViewer(v => v - 1)} accessibilityLabel="Previous">
                <Ionicons name="chevron-back" size={30} color={viewer === 0 ? '#475569' : '#fff'} />
              </TouchableOpacity>
              <Text style={styles.viewerCap} numberOfLines={1}>
                {photos[viewer].event || photos[viewer].file_name} · {viewer + 1}/{photos.length}
              </Text>
              <TouchableOpacity
                disabled={viewer === photos.length - 1}
                onPress={() => setViewer(v => v + 1)}
                accessibilityLabel="Next"
              >
                <Ionicons name="chevron-forward" size={30} color={viewer === photos.length - 1 ? '#475569' : '#fff'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipSub: { fontSize: 11, color: '#64748b' },
  chipTextOn: { color: '#fff' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  tabOn: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabTextOn: { color: '#4f46e5' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 11 },
  btnText: { color: '#fff', fontWeight: '600' },
  btnOutline: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4f46e5', borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16 },
  btnOutlineText: { color: '#4f46e5', fontWeight: '600' },
  btnOff: { opacity: 0.5 },
  upload: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  uploadName: { flex: 1, fontSize: 12, color: '#475569' },
  uploadStatus: { fontSize: 12, color: '#64748b', maxWidth: '55%' },
  hint: { fontSize: 11, color: '#94a3b8' },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24, fontSize: 14 },
  group: { marginBottom: 18 },
  event: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  date: { fontSize: 12, fontWeight: '400', color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heic: { borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  heicText: { fontSize: 11, color: '#94a3b8' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 6 },
  docName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  docMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 40, right: 16, padding: 8 },
  viewerBar: { position: 'absolute', bottom: 32, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  viewerCap: { color: '#e2e8f0', fontSize: 13, flex: 1, textAlign: 'center' },
});
