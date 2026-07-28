import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './AppText';
import { TextInput } from './AppTextInput';
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

function formatDobDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RegistrationFormModal({ visible, programId, onClose }: Props) {
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : insets.top;
  const phoneInputRef = useRef<PhoneInput>(null);

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [phone, setPhone] = useState('');
  const [indiaDigits, setIndiaDigits] = useState('');
  const [place, setPlace] = useState('');
  const [churchDetails, setChurchDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const programLabel = PROGRAMS[programId].label;
  // TGH Academy is an offline, Tirupur-based program — restrict it to Indian
  // mobile numbers with a fixed +91 code. The Youth Program stays international.
  const isIndiaOnly = programId === 'academy';
  const effectivePhone = isIndiaOnly ? (indiaDigits ? `+91${indiaDigits}` : '') : phone;

  const resetForm = () => {
    setName('');
    setDob(null);
    setGender(null);
    setPhone('');
    setIndiaDigits('');
    setPlace('');
    setChurchDetails('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    handleClose();
  };

  const onChangeDob = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) setDob(selectedDate);
  };

  const handleSubmit = async () => {
    const dobIso = dob ? toIsoDate(dob) : '';
    const nameError = validateName(name);
    if (nameError) { Alert.alert('Invalid Name', nameError); return; }
    const dobError = validateDob(dobIso);
    if (dobError) { Alert.alert('Invalid Date of Birth', dobError); return; }
    if (!gender) { Alert.alert('Gender Required', 'Please select your gender.'); return; }
    const phoneError = isIndiaOnly ? validateIndianMobile(indiaDigits) : validatePhone(phone);
    if (phoneError) { Alert.alert('Invalid Mobile Number', phoneError); return; }
    const placeError = validatePlace(place);
    if (placeError) { Alert.alert('Invalid Place', placeError); return; }

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
      setShowSuccess(true);
    } catch (e) {
      if (e instanceof DuplicateRegistrationError) {
        Alert.alert('Already Registered', 'This mobile number has already been registered for this program.');
      } else {
        Alert.alert('Error', 'Could not submit your registration. Please check your internet connection and try again.');
      }
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
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

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.programBanner, { backgroundColor: colors.raised, borderLeftColor: colors.accent }]}>
              <Text style={[styles.programBannerLabel, { color: colors.subtext }]}>You wish to register for the program:</Text>
              <Text style={[styles.programBannerTitle, { color: colors.accent }]}>{programLabel}</Text>
            </View>

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

            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.subtext }]}>Date of Birth *</Text>
              <TouchableOpacity
                style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: dob ? colors.text : colors.subtext, fontSize: 15 }}>
                  {dob ? formatDobDisplay(dob) : 'Select your date of birth'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dob ?? new Date(TODAY.getFullYear() - 20, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={TODAY}
                  minimumDate={MIN_DOB_DATE}
                  onChange={onChangeDob}
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.accent }]} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}
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
                <PhoneInput
                  ref={phoneInputRef}
                  defaultCode="IN"
                  layout="second"
                  withDarkTheme={theme === 'dark'}
                  onChangeFormattedText={setPhone}
                  containerStyle={[styles.phoneContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}
                  textContainerStyle={[styles.phoneTextContainer, { backgroundColor: colors.surfaceAlt }]}
                  textInputStyle={[styles.phoneTextInput, { color: colors.text }]}
                  codeTextStyle={[styles.phoneCodeText, { color: colors.text }]}
                  textInputProps={{ placeholderTextColor: colors.subtext }}
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
              style={[styles.submitBtn, { backgroundColor: colors.accent }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : '✅ Submit Registration'}</Text>
            </TouchableOpacity>
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
                <Text style={[styles.successSubtext, { color: colors.subtext }]}>We&apos;ll be in touch with you soon.</Text>
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
  programBanner: { borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4 },
  programBannerLabel: { fontSize: 12, marginBottom: 2 },
  programBannerTitle: { fontSize: 16, fontWeight: 'bold' },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  formInput: { borderRadius: 10, padding: 12, fontSize: 15, elevation: 2, borderWidth: 1, justifyContent: 'center' },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  doneBtn: { alignSelf: 'flex-end', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  doneBtnText: { color: '#fff', fontWeight: '600' },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  segmentBtnText: { fontSize: 13, fontWeight: '600' },
  phoneContainer: { width: '100%', height: 56, borderRadius: 10, borderWidth: 1, elevation: 2 },
  phoneTextContainer: { borderRadius: 10, paddingVertical: 0 },
  phoneTextInput: { fontSize: 15 },
  phoneCodeText: { fontSize: 15 },
  indiaPhoneRow: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 10, borderWidth: 1, elevation: 2 },
  indiaPhoneCode: { paddingHorizontal: 14, height: '100%', justifyContent: 'center', borderRightWidth: 1 },
  indiaPhoneCodeText: { fontSize: 15, fontWeight: '600' },
  indiaPhoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 15, height: '100%' },
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
