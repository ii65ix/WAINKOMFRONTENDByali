import { deleteEventApi, fetchEventsApi, updateEventApi } from "@/api/events";
import { getOrgProfile } from "@/api/organizer";
import { deleteToken } from "@/api/storage";
import { COLORS } from "@/assets/style/color";
import AuthContext from "@/context/authcontext";
import { formatDateNice } from "@/utils/dateHelpers";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type EventDoc = {
  _id: string;
  title: string;
  description?: string;
  desc?: string;
  image: string;
  date: string;
  time: string;
  categoryId?: string;
};

const OrganizerHomeScreen = () => {
  const { setIsAuthenticated, setIsOrganizer } = useContext(AuthContext);

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [orgImage, setOrgImage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<EventDoc | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await deleteToken();
          setIsAuthenticated(false);
          setIsOrganizer(false);
          router.replace("/(auth)");
        },
      },
    ]);
  };

  const loadData = async (opts: { initial?: boolean } = {}) => {
    const isInitial = !!opts.initial;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [eventsData, org] = await Promise.allSettled([
        fetchEventsApi(),
        getOrgProfile(),
      ]);

      if (!mountedRef.current) return;

      if (eventsData.status === "fulfilled") setEvents(eventsData.value);
      if (org.status === "fulfilled") setOrgImage(org.value?.image);
    } catch (err) {
      console.log("Load error:", err);
    } finally {
      if (!mountedRef.current) return;
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadData({ initial: true });
    const interval = setInterval(() => {
      loadData({ initial: false });
    }, 15000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const openEdit = (event: EventDoc) => {
    setSelectedEvent(event);
    setNewTitle(event.title);
    setNewDescription(event.description || event.desc || "");
    setNewImage(event.image);
    setEditModalVisible(true);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.9,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets?.length > 0) {
      setNewImage(result.assets[0].uri);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedEvent) return;
    if (!newTitle.trim()) {
      Alert.alert("Validation", "Title cannot be empty.");
      return;
    }
    try {
      await updateEventApi(selectedEvent._id, {
        title: newTitle,
        description: newDescription,
        image: newImage ?? undefined,
      });
      Alert.alert("Updated", "Event updated successfully!");
      setEditModalVisible(false);
      loadData({ initial: false });
    } catch {
      Alert.alert("Error", "Failed to update event.");
    }
  };

  const handleDelete = (eventId: string) => {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEventApi(eventId);
            Alert.alert("Deleted", "Event has been deleted.");
            loadData({ initial: false });
          } catch {
            Alert.alert("Error", "Failed to delete event.");
          }
        },
      },
    ]);
  };

  // Using utility function from @/utils/dateHelpers

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: COLORS.backgroundd,
        }}
      >
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.backgroundd}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeader}>
            <Text style={styles.appTitle}>EventHub Kuwait</Text>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              {refreshing && (
                <ActivityIndicator size="small" color={COLORS.primary} />
              )}

              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => router.push("/createEvent")}
              >
                <Ionicons name="add" size={18} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() =>
                  Alert.alert("Notifications", "No notifications yet.")
                }
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={COLORS.text}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/organizer/profile")}
              >
                {orgImage ? (
                  <Image source={{ uri: orgImage }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={18} color={COLORS.muted} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>My Events</Text>

          {events.length === 0 ? (
            <Text style={{ color: COLORS.muted, paddingHorizontal: 4 }}>
              No events yet.
            </Text>
          ) : (
            events.map((ev) => (
              <View key={ev._id} style={styles.eventCard}>
                <Image source={{ uri: ev.image }} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventDesc}>
                    {ev.description || ev.desc}
                  </Text>
                  <Text style={styles.dateText}>{formatDateNice(ev.date)}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEdit(ev)}
                    >
                      <Ionicons name="create-outline" size={16} color="#fff" />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(ev._id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.actionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Event</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />

            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.imagePicker}
            >
              {newImage ? (
                <Image source={{ uri: newImage }} style={styles.previewImg} />
              ) : (
                <Ionicons name="image-outline" size={32} color={COLORS.muted} />
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Update event description..."
              placeholderTextColor={COLORS.muted}
              multiline
              style={styles.textArea}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: COLORS.surfaceAlt },
                ]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ color: COLORS.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSaveChanges}
              >
                <Text style={{ color: COLORS.backgroundn, fontWeight: "800" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.backgroundd },
  container: { flex: 1 },
  scroll: { padding: 16 },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  appTitle: { color: COLORS.heading, fontSize: 22, fontWeight: "800" },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.heading,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    padding: 10,
    marginBottom: 12,
  },
  thumb: { width: 90, height: 90, borderRadius: 10 },
  eventTitle: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  eventDesc: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  dateText: { color: COLORS.primary, fontSize: 12, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  editBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  deleteBtn: {
    flexDirection: "row",
    backgroundColor: "#D64545",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    width: "100%",
  },
  modalTitle: {
    color: COLORS.heading,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.text,
    padding: 10,
    marginBottom: 10,
  },
  imagePicker: {
    height: 150,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  previewImg: { width: "100%", height: "100%", borderRadius: 12 },
  label: { color: COLORS.text, fontWeight: "700", marginBottom: 6 },
  textArea: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.text,
    padding: 10,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
});

export default OrganizerHomeScreen;
