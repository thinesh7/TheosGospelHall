import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDialog } from './AppDialog';
import { Text } from './AppText';
import { TextInput } from './AppTextInput';
import DateField, { formatDateDisplay } from './fields/DateField';
import PhoneField from './fields/PhoneField';
import { useBreakpoint } from '../hooks/use-breakpoint';
import {
  DuplicateRegistrationError,
  Gender,
  ProgramId,
  PROGRAMS,
  submitRegistration,
  validateDob,
  validateIndianMobile,
  validateName,
  validatePhone,
  validatePlace,
} from '../utils/registrations';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  visible: boolean;
  programId: ProgramId;
  onClose: () => void;
}

const TODAY = new Date();
const MIN_DOB_DATE = new Date();
MIN_DOB_DATE.setFullYear(TODAY.getFullYear() - 120);
const DEFAULT_DOB_PICKER_DATE = new Date(TODAY.getFullYear() - 20, 0, 1);

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RegistrationFormModal({ visible, programId, onClose }: Props) {
  const { theme, colors } = useTheme();
  const { isTabletUp } = useBreakpoint();
  const dialog = useAppDialog();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : insets.top;

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [phone, setPhone] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [callingCode, setCallingCode] = useState('91');
  const [indiaDigits, setIndiaDigits] = useState('');
  const [place, setPlace] = useState('');
  const [churchDetails, setChurchDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Bumped only on a full reset (not on Preview/Edit toggling) to force
  // PhoneInput to remount with blank state for a new registration attempt —
  // it isn't a true controlled component, so setPhone('') alone wouldn't
  // clear what it displays.
  const [formKey, setFormKey] = useState(0);

  const programLabel = PROGRAMS[programId].label;
  // TGH Academy is an offline, Tirupur-based program — restrict it to Indian
  // mobile numbers with a fixed +91 code. The Youth Program stays international.
  const isIndiaOnly = programId === 'academy';
  const effectivePhone = isIndiaOnly ? (indiaDigits ? `+91${indiaDigits}` : '') : phone;
  // Display-only, dash-separated "+<country code>-<number>" form (e.g.
  // +91-7501234567) for the review screen — effectivePhone above stays
  // undelimited since that's the format stored in Firestore and checked
  // for duplicates.
  const displayPhone = isIndiaOnly
    ? (indiaDigits ? `+91-${indiaDigits}` : '')
    : (phoneDigits ? `+${callingCode}-${phoneDigits}` : '');

  const resetForm = () => {
    setName('');
    setDob(null);
    setGender(null);
    setPhone('');
    setPhoneDigits('');
    setCallingCode('91');
    setIndiaDigits('');
    setPlace('');
    setChurchDetails('');
    setShowPreview(false);
    setFormKey(k => k + 1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleModalRequestClose = () => {
    if (showPreview) { setShowPreview(false); return; }
    handleClose();
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    handleClose();
  };

  const handleContinue = () => {
    const dobIso = dob ? toIsoDate(dob) : '';
    const nameError = validateName(name);
    if (nameError) { dialog.alert('Invalid Name', nameError); return; }
    const dobError = validateDob(dobIso);
    if (dobError) { dialog.alert('Invalid Date of Birth', dobError); return; }
    if (!gender) { dialog.alert('Gender Required', 'Please select your gender.'); return; }
    const phoneError = isIndiaOnly ? validateIndianMobile(indiaDigits) : validatePhone(phone);
    if (phoneError) { dialog.alert('Invalid Mobile Number', phoneError); return; }
    const placeError = validatePlace(place);
    if (placeError) { dialog.alert('Invalid Place', placeError); return; }

    setShowPreview(true);
  };

  const handleConfirmSubmit = async () => {
    const dobIso = dob ? toIsoDate(dob) : '';
    if (!gender) return; // already validated before reaching preview

    setSubmitting(true);
    try {
      await submitRegistration(programId, {
        name,
        dob: dobIso,
        gender,
        phone: effectivePhone,
        place,
        churchDetails,
      });
      setShowPreview(false);
      setShowSuccess(true);
    } catch (e) {
      if (e instanceof DuplicateRegistrationError) {
        dialog.alert('Already Registered', 'This mobile number has already been registered for this program.');
      } else {
        dialog.alert('Error', 'Could not submit your registration. Please check your internet connection and try again.');
      }
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleModalRequestClose}>
      <StatusBar barStyle={theme === 'light' || theme === 'sepia' ? 'dark-content' : 'light-content'} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : 'padding'} style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.divider, paddingTop: statusBarHeight + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>📝 Registration</Text>
              <Text style={[styles.headerSub, { color: colors.subtext }]} numberOfLines={2}>{programLabel}</Text>
              <View style={[styles.modeBadge, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[styles.modeBadgeText, { color: colors.accent }]}>{PROGRAMS[programId].mode}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[{ padding: 16, paddingBottom: 24 }, isTabletUp && styles.scrollContentDesktop]}
            keyboardShouldPersistTaps="handled"
          >
          <View style={isTabletUp && styles.formColumn}>
            <View style={[styles.programBanner, { backgroundColor: colors.raised, borderLeftColor: colors.accent }]}>
              <Text style={[styles.programBannerLabel, { color: colors.subtext }]}>You wish to register for the program:</Text>
              <Text style={[styles.programBannerTitle, { color: colors.accent }]}>{programLabel}</Text>
            </View>

            {/*
              Rendered with `display: none` rather than unmounted (`showPreview && ...`)
              when previewing. PhoneInput (from react-native-phone-number-input) isn't a
              true controlled component — it only initializes its internal number/country
              state from props on mount — so conditionally unmounting this block on every
              Edit/Preview round-trip was silently resetting the typed phone number and
              country selection back to blank/default each time.
            */}
            <View style={{ display: showPreview ? 'none' : 'flex' }}>
            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                placeholder="Your full name"
                placeholderTextColor={colors.subtext}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={[styles.formField, isTabletUp && styles.dobFieldDesktop]}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Date of Birth *</Text>
              <DateField
                value={dob}
                onChange={setDob}
                minimumDate={MIN_DOB_DATE}
                maximumDate={TODAY}
                defaultDate={DEFAULT_DOB_PICKER_DATE}
                placeholder="Select your date of birth"
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Gender *</Text>
              <View style={styles.segmentRow}>
                {(['Male', 'Female'] as Gender[]).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.segmentBtn,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.divider },
                      gender === g && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.segmentBtnText, { color: gender === g ? '#fff' : colors.subtext }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Mobile Number (WhatsApp Number) *</Text>
              {isIndiaOnly ? (
                <View style={[styles.indiaPhoneRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}>
                  <View style={[styles.indiaPhoneCode, { borderRightColor: colors.divider }]}>
                    <Text style={[styles.indiaPhoneCodeText, { color: colors.text }]}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={[styles.indiaPhoneInput, { color: colors.text }]}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.subtext}
                    value={indiaDigits}
                    onChangeText={v => setIndiaDigits(v.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              ) : (
                <PhoneField
                  formKey={formKey}
                  defaultCountry="IN"
                  onChange={({ formattedNumber, nationalNumber, callingCode: code }) => {
                    setPhone(formattedNumber);
                    setPhoneDigits(nationalNumber);
                    setCallingCode(code);
                  }}
                />
              )}
            </View>

            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Place *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                placeholder="Your city / town"
                placeholderTextColor={colors.subtext}
                value={place}
                onChangeText={setPlace}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Church Details (Optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMulti, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                placeholder="Your home church, if any"
                placeholderTextColor={colors.subtext}
                value={churchDetails}
                onChangeText={setChurchDetails}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.accent }]}
              onPress={handleContinue}
            >
              <Text style={styles.submitBtnText}>Continue</Text>
            </TouchableOpacity>
            </View>

            {showPreview && (
              <View style={styles.formField}>
                <View style={[styles.previewCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}>
                  <Text style={[styles.previewCardTitle, { color: colors.accent }]}>Review Your Registration</Text>
                  <PreviewRow label="Program" value={programLabel} colors={colors} />
                  <PreviewRow label="Name" value={name} colors={colors} />
                  <PreviewRow label="Date of Birth" value={dob ? formatDateDisplay(dob) : '—'} colors={colors} />
                  <PreviewRow label="Gender" value={gender ?? '—'} colors={colors} />
                  <PreviewRow label="Mobile Number" value={displayPhone || '—'} colors={colors} />
                  <PreviewRow label="Place" value={place} colors={colors} />
                  <PreviewRow label="Church Details" value={churchDetails || 'Not provided'} colors={colors} last />
                </View>

                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                  <Text style={[styles.warningText, { color: colors.text }]}>
                    Please review carefully. Once submitted, this information cannot be changed, and we may be unable to contact you if any details are incorrect.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.editBtn, { borderColor: colors.accent }]}
                  onPress={() => setShowPreview(false)}
                  disabled={submitting}
                >
                  <Text style={[styles.editBtnText, { color: colors.accent }]}>✏️ Edit Information</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.accent }, submitting && { opacity: 0.6 }]}
                  onPress={handleConfirmSubmit}
                  disabled={submitting}
                >
                  <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : '✅ Proceed with Submission'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          </ScrollView>

          {showSuccess && (
            <View style={styles.successOverlay}>
              <View style={[styles.successCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.successIconCircle, { backgroundColor: colors.accent }]}>
                  <Ionicons name="checkmark" size={40} color="#fff" />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>Thank You!</Text>
                <Text style={[styles.successMessage, { color: colors.subtext }]}>
                  Your registration for{' '}
                  <Text style={[styles.successProgramName, { color: colors.accent }]}>{programLabel}</Text> has been received.
                </Text>
                <Text style={[styles.successSubtext, { color: colors.subtext }]}>We&apos;ll get in touch with you soon.</Text>
                <TouchableOpacity style={[styles.successBtn, { backgroundColor: colors.accent }]} onPress={handleSuccessDone}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PreviewRow({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: { text: string; subtext: string; divider: string };
  last?: boolean;
}) {
  return (
    <View style={[styles.previewRow, !last && { borderBottomColor: colors.divider, borderBottomWidth: 1 }]}>
      <Text style={[styles.previewRowLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.previewRowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSub: { fontSize: 12, marginTop: 2 },
  modeBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },
  closeBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 12 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  // On tablet-up, the whole form/review column is capped to a comfortable
  // single-column reading/data-entry width instead of stretching across the
  // full browser window — narrower than the app's general CONTENT_MAX_WIDTH
  // (meant for dashboards/grids), matching what a data-entry form actually
  // benefits from.
  scrollContentDesktop: { alignItems: 'center' },
  formColumn: { width: '100%', maxWidth: 640 },
  // A native <input type="date"> doesn't need the full form-column width —
  // capped separately so it doesn't visually stretch even within the
  // already-narrowed formColumn.
  dobFieldDesktop: { width: '100%', maxWidth: 320 },
  programBanner: { borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4 },
  programBannerLabel: { fontSize: 12, marginBottom: 2 },
  programBannerTitle: { fontSize: 16, fontWeight: 'bold' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  formInput: { borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, justifyContent: 'center' },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  segmentBtnText: { fontSize: 13, fontWeight: '600' },
  indiaPhoneRow: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 10, borderWidth: 1, elevation: 2 },
  indiaPhoneCode: { paddingHorizontal: 14, height: '100%', justifyContent: 'center', borderRightWidth: 1 },
  indiaPhoneCodeText: { fontSize: 15, fontWeight: '600' },
  indiaPhoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 15, height: '100%' },
  previewCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16, elevation: 2 },
  previewCardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  previewRow: { paddingVertical: 10 },
  previewRowLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  previewRowValue: { fontSize: 15 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19 },
  editBtn: { borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 12, borderWidth: 2 },
  editBtnText: { fontWeight: 'bold', fontSize: 15 },
  submitBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 24, elevation: 4 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,20,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  successTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  successMessage: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  successProgramName: { fontWeight: 'bold' },
  successSubtext: { fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20, fontStyle: 'italic' },
  successBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, elevation: 3 },
  successBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
