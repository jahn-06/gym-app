import { Ionicons } from '@expo/vector-icons';

import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable,ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/confirm-modal';
import { DatePickerModal } from '@/components/date-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { getMembershipLabel, todayIso } from '@/lib/membership';
import { supabase } from '@/lib/supabase';

type MembershipRow = {
  id: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  membership_types: { name: string } | null;
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [isBirthDatePickerOpen, setIsBirthDatePickerOpen] = useState(false);

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Načtení profilu je samostatná znovupoužitelná funkce - potřebujeme ji
  // volat jak při příchodu na obrazovku, tak znovu při stisku "Zrušit"
  // (abychom políčka vrátili na naposled uloženou hodnotu z databáze).
  const loadProfile = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, birth_date')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPhone(data.phone ?? '');
      setBirthDate(isoToDate(data.birth_date));
    }

    const { data: membershipData } = await supabase
      .from('memberships')
      .select('id, status, starts_on, ends_on, membership_types(name)')
      .eq('user_id', session.user.id)
      .gte('ends_on', todayIso())
      .order('starts_on', { ascending: true });

    setMemberships((membershipData as unknown as MembershipRow[]) ?? []);

    const { data: referralStats } = (await supabase.rpc('get_my_referral_stats').single()) as {
      data: { referral_code: string; referred_count: number } | null;
    };

    if (referralStats) {
      setReferralCode(referralStats.referral_code);
      setReferredCount(Number(referralStats.referred_count));
    }

    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  function handleStartEditing() {
    setProfileMessage(null);
    setIsEditing(true);
  }

  function handleCancelEditing() {
    loadProfile(); // vrátí políčka na hodnoty z databáze, zahodí rozepsané změny
    setIsEditing(false);
  }

  function handleRequestSave() {
    setIsConfirmOpen(true);
  }

  async function handleConfirmSave() {
    if (!session) return;
    setIsConfirmOpen(false);
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        birth_date: birthDate ? dateToIso(birthDate) : null,
      })
      .eq('id', session.user.id);

    setIsSaving(false);

    if (error) {
      setProfileMessage('Uložení se nezdařilo, zkuste to znovu.');
      return;
    }

    setProfileMessage('Údaje byly uloženy.');
    setIsEditing(false);
    setTimeout(() => setProfileMessage(null), 3000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleCopyReferralLink() {
    if (!referralCode) return;
    const link = Linking.createURL('/register', { queryParams: { ref: referralCode } });
    await Clipboard.setStringAsync(link);
    setCopyMessage('Odkaz zkopírován do schránky.');
    setTimeout(() => setCopyMessage(null), 3000);
  }

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={{ padding: Spacing.four, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>        
          <ThemedView style={styles.headerRow}>
          <ThemedView style={{ backgroundColor: 'transparent' }}>
            <ThemedText type="title">Profil</ThemedText>
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
              {session?.user.email}
            </ThemedText>
          </ThemedView>

          {!isEditing && (
            <Pressable
              onPress={handleStartEditing}
              style={[styles.editIconButton, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="pencil-outline" size={18} color={theme.text} />
            </Pressable>
          )}
        </ThemedView>

        {profileMessage && (
          <ThemedText
            type="small"
            themeColor={profileMessage.startsWith('Uložení') ? 'danger' : 'textSecondary'}
            style={{ marginTop: Spacing.two }}>
            {profileMessage}
          </ThemedText>
        )}

        <ThemedView style={styles.form}>
          {isEditing ? (
            <>
              <Field label="Jméno">
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="Jméno"
                  placeholderTextColor={theme.textSecondary}
                />
              </Field>

              <Field label="Příjmení">
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="Příjmení"
                  placeholderTextColor={theme.textSecondary}
                />
              </Field>

              <Field label="Telefon">
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  placeholder="+420 777 123 456"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Datum narození">
                <Pressable
                  onPress={() => setIsBirthDatePickerOpen(true)}
                  style={[styles.input, styles.dateField, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText themeColor={birthDate ? 'text' : 'textSecondary'}>
                    {birthDate ? birthDate.toLocaleDateString('cs-CZ') : 'Vyberte datum'}
                  </ThemedText>
                </Pressable>
              </Field>

              <ThemedView style={styles.editActionsRow}>
                <Pressable onPress={handleCancelEditing} style={styles.cancelEditButton}>
                  <ThemedText type="smallBold">Zrušit</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleRequestSave}
                  disabled={isSaving}
                  style={[styles.saveButton, isSaving && { opacity: 0.6 }]}>
                  {isSaving ? (
                    <ActivityIndicator color={Colors.light.onAccent} />
                  ) : (
                    <ThemedText type="smallBold" themeColor="onAccent">
                      Uložit změny
                    </ThemedText>
                  )}
                </Pressable>
              </ThemedView>
            </>
          ) : (
            <>
              <ReadOnlyField label="Jméno" value={firstName} />
              <ReadOnlyField label="Příjmení" value={lastName} />
              <ReadOnlyField label="Telefon" value={phone} />
              <ReadOnlyField label="Datum narození" value={birthDate ? birthDate.toLocaleDateString('cs-CZ') : ''} />
            </>
          )}
        </ThemedView>

        <ThemedView style={styles.membershipsSection}>
          <ThemedText type="smallBold">Vaše permanentky</ThemedText>

          {memberships.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Zatím nemáte žádnou permanentku.
            </ThemedText>
          ) : (
            memberships.map((m) => (
              <ThemedView key={m.id} style={[styles.membershipRow, { backgroundColor: theme.backgroundElement }]}>
                <ThemedView style={{ backgroundColor: 'transparent' }}>
                  <ThemedText type="small">{m.membership_types?.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {getMembershipLabel(m.starts_on, m.ends_on) === 'pending' ? 'Čeká na start' : 'Aktivní'} · do{' '}
                    {m.ends_on ? new Date(m.ends_on).toLocaleDateString('cs-CZ') : '-'}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            ))
          )}

          <Pressable style={styles.buyLink} onPress={() => router.push('/buy-membership')}>
            <ThemedText type="smallBold" themeColor="onAccent">
              Koupit permanentku
            </ThemedText>
          </Pressable>
        </ThemedView>

        {referralCode && (
          <ThemedView style={styles.referralSection}>
            <ThemedText type="smallBold">Doporučte nás</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Za každého kamaráda, který si po registraci koupí první permanentku, získáte vy i on 5 dní navíc zdarma.
            </ThemedText>

            <ThemedView style={[styles.codeBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="title">{referralCode}</ThemedText>
            </ThemedView>

            <Pressable style={styles.shareButton} onPress={handleCopyReferralLink}>
              <ThemedText type="smallBold" themeColor="onAccent">
                Zkopírovat odkaz ke sdílení
              </ThemedText>
            </Pressable>

            {copyMessage && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {copyMessage}
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Zatím jste pozvali: {referredCount} {referredCount === 1 ? 'osobu' : 'lidí'}
            </ThemedText>
          </ThemedView>
        )}

        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <ThemedText type="smallBold" themeColor="danger">
            Odhlásit se
          </ThemedText>
        </Pressable>
        </ScrollView>
      </SafeAreaView>

      <DatePickerModal
        visible={isBirthDatePickerOpen}
        initialDate={birthDate}
        minDate={new Date(1920, 0, 1)}
        maxDate={new Date()}
        title="Datum narození"
        onCancel={() => setIsBirthDatePickerOpen(false)}
        onConfirm={(date) => {
          setBirthDate(date);
          setIsBirthDatePickerOpen(false);
        }}
      />

      <ConfirmModal
        visible={isConfirmOpen}
        title="Uložit změny?"
        message="Opravdu chcete změnit své údaje?"
        confirmLabel="Uložit"
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      />
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText themeColor={value ? 'text' : 'textSecondary'}>{value || 'Nevyplněno'}</ThemedText>
    </ThemedView>
  );
}

// Databáze (Postgres "date" sloupec) pracuje s formátem "YYYY-MM-DD" jako
// textem. Appka ale interně pracuje s JS objektem Date - tyhle dvě funkce
// mezi formáty převádí tam a zpět.
function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  editIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  dateField: {
    justifyContent: 'center',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    backgroundColor: 'transparent',
  },
  cancelEditButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D2D8',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  membershipsSection: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  membershipRow: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  buyLink: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  signOutButton: {
    marginTop: Spacing.five,
    borderWidth: 1,
    borderColor: Colors.light.danger,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  referralSection: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  codeBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.two,
  },
  shareButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
