import React, { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppText } from '@/components/ui/text';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { createOrgScreenStyles } from '@/theme/createStep10Styles';
import { useNavigation } from '@react-navigation/native';
import CountryPicker, {
  Country,
  CountryCode,
} from 'react-native-country-picker-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostRequest, PutRequest } from '@/utils/requests';
import { storeMultipleData } from '@/utils/helper';
import { ACTIONS } from '@/store/types';
import { useDataContext } from '@/store/useDataContext';

const AddOrganisationScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createOrgScreenStyles(colors), [colors]);
  const countryPickerTheme = useMemo(
    () => ({
      backgroundColor: colors.surface,
      onBackgroundTextColor: colors.textPrimary,
      primaryColor: colors.border,
      primaryColorVariant: colors.reactionBackground,
      filterPlaceholderTextColor: colors.textMuted,
    }),
    [colors],
  );
  const navigation = useNavigation();
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [countryCode, setCountryCode] = useState<CountryCode>('US');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useDataContext();
  const { user } = state;

  const resetForm = () => {
    setOrgName('');
    setOrgType('');
    setCountry(null);
    setCountryCode('US');
  };

  const handleSubmit = async () => {
    setLoading(true);

    const payload = {
      name: orgName,
      type: orgType,
      country: country
        ? typeof country.name === 'string'
          ? country.name
          : country.name.common
        : null,
      email: user?.email,
    };

    const { data: res, error } = await PostRequest('/organisations', payload);

    if (!error) {
      const switchPayload = {
        current_org: res.data.id,
      };

      const { data, error } = await PutRequest(
        '/users/switch-org',
        switchPayload,
      );

      if (!error) {
        await storeMultipleData([
          ['token', data.data.access_token],
          ['current_org', data.data.organisation.id],
          ['organisation', data.data.organisation],
        ]);

        dispatch({ type: ACTIONS.TOKEN, payload: data.data.access_token });
        dispatch({ type: ACTIONS.ORG_ID, payload: data.data.organisation.id });
        dispatch({ type: ACTIONS.ORG_DATA, payload: data.data.organisation });
      }

      resetForm();
      navigation.goBack();
      setLoading(false);
    } else {
      dispatch({ type: ACTIONS.ERROR, payload: error });
      setLoading(false);
    }
  };

  const onSelect = (selectedCountry: Country) => {
    setCountryCode(selectedCountry.cca2);
    setCountry(selectedCountry);
    setShowCountryPicker(false);
  };

  //

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <AppText variant="bold" size={28} style={styles.title}>
            Create Your Organisation
          </AppText>
          <AppText size={16} style={styles.subtitle}>
            Input the details of your organisation below
          </AppText>

          <View style={styles.formGroup}>
            <AppText size={15} style={styles.label}>
              Organisation Name
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Enter your organisation name"
              placeholderTextColor={colors.textMuted}
              value={orgName}
              onChangeText={setOrgName}
            />
          </View>

          <View style={styles.formGroup}>
            <AppText size={15} style={styles.label}>
              Organisation Type
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="What does your organisation do"
              placeholderTextColor={colors.textMuted}
              value={orgType}
              onChangeText={setOrgType}
            />
          </View>

          <View style={styles.formGroup}>
            <AppText size={15} style={styles.label}>
              Country
            </AppText>
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.8}
            >
              <AppText
                size={15}
                style={
                  country
                    ? styles.countrySelectorText
                    : styles.countrySelectorPlaceholder
                }
              >
                {country
                  ? typeof country.name === 'string'
                    ? country.name
                    : country.name.common
                  : 'Select an option...'}
              </AppText>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            <CountryPicker
              countryCode={countryCode}
              visible={showCountryPicker}
              withFilter
              withFlag
              withCountryNameButton={false}
              withAlphaFilter
              onSelect={onSelect}
              onClose={() => setShowCountryPicker(false)}
              theme={countryPickerTheme}
              modalProps={{
                visible: showCountryPicker,
              }}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (loading || !orgName || !orgType || !country) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading || !orgName || !orgType || !country}
          >
            {loading && <ActivityIndicator color={colors.white} />}

            <AppText variant="bold" size={18} style={{ color: colors.white }}>
              Submit
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddOrganisationScreen;
