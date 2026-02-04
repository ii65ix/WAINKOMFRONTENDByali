import { CategoryItem, fetchCategories } from "@/api/categories";
import { EventItem, fetchEvents } from "@/api/events";
import { COLORS } from "@/assets/style/color";
import { LAYOUT, SPACING, TYPO } from "@/assets/style/stylesheet";
import ReviewModal from "@/components/ReviewModal";
import AuthContext from "@/context/authcontext";
import {
  getNextWeek,
  getThisMonth,
  getThisWeek,
  getThisWeekend,
} from "@/utils/dateHelpers";
import { groupEventsByCategory } from "@/utils/eventHelpers";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type EventsByCategory = Record<string, EventItem[]>;

export default function Index() {
  const { isAuthenticated } = useContext(AuthContext);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [locationLabel, setLocationLabel] = useState<string>("Location");
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [ev, cats] = await Promise.all([
          fetchEvents(),
          fetchCategories(),
        ]);
        if (!isMounted) return;
        setEvents(Array.isArray(ev) ? ev : []);
        setCategories(Array.isArray(cats) ? cats : []);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Resolve user's city using Google Geocoding API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          if (!cancelled) setLocationLabel("Kuwait City, KW");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const key =
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          (process.env as any).GOOGLE_API_KEY;
        if (!key) {
          // Fallback to city via Expo reverse geocode if API key missing
          const local = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
          });
          const best = local?.[0];
          if (!cancelled)
            setLocationLabel(
              `${best?.city || best?.subregion || "Unknown"}, ${
                best?.isoCountryCode || ""
              }`.trim()
            );
          return;
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        const comp = data?.results?.[0]?.address_components as
          | Array<any>
          | undefined;
        const byType = (t: string) =>
          comp?.find((c) => (c.types || []).includes(t))?.long_name;
        const city =
          byType("locality") ||
          byType("administrative_area_level_1") ||
          byType("sublocality") ||
          "Unknown";
        const country = byType("country") || "";
        if (!cancelled) setLocationLabel(`${city}, ${country}`.trim());
      } catch {
        if (!cancelled) setLocationLabel("Kuwait City, KW");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trending: EventItem | undefined = useMemo(() => {
    if (!events.length) return undefined;
    // Heuristic: prefer highest rating, otherwise the soonest upcoming by date
    const byRating = [...events].sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
    );
    const topRated = byRating[0];
    if (topRated && (topRated.rating ?? 0) > 0) return topRated;
    const byDate = [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return byDate[0];
  }, [events]);

  const eventsByTimePeriod = useMemo(() => {
    const thisWeekend = getThisWeekend(events);
    const thisWeek = getThisWeek(events);
    const nextWeek = getNextWeek(events);
    const thisMonth = getThisMonth(events);

    const result: { [key: string]: EventItem[] } = {};

    if (thisWeekend.length > 0) result["This Weekend"] = thisWeekend;
    if (thisWeek.length > 0) result["This Week"] = thisWeek;
    if (nextWeek.length > 0) result["Next Week"] = nextWeek;
    if (thisMonth.length > 0) result["This Month"] = thisMonth;

    return result;
  }, [events]);

  const eventsByCategory: EventsByCategory = useMemo(() => {
    return groupEventsByCategory(events);
  }, [events]);

  const getCategoryName = (id: string | undefined) => {
    if (!id) return "Other";
    const c = categories.find(
      (x) =>
        x._id === id ||
        x.key === id ||
        (typeof x.name === "string" && x.name === id)
    );
    return (
      c?.label || (typeof c?.name === "string" ? c?.name : undefined) || "Other"
    );
  };

  const renderEventCard = (item: EventItem) => {
    return (
      <TouchableOpacity
        key={item._id}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: 12,
          marginRight: 12,
          width: 260,
        }}
        onPress={() => {
          setSelectedEvent(item);
          setModalVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${item.title}`}
        activeOpacity={0.9}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={{
              width: "100%",
              height: 140,
              borderRadius: 12,
              marginBottom: 10,
            }}
          />
        ) : null}
        <Text
          style={{ color: COLORS.text, fontWeight: "800", fontSize: 16 }}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {item.description || item.desc ? (
          <Text style={{ color: COLORS.muted, marginTop: 4 }} numberOfLines={2}>
            {item.description ?? item.desc}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", marginTop: 8, columnGap: 10 }}>
          {!!item.date && (
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>
              {new Date(item.date).toDateString()}
            </Text>
          )}
          {!!item.time && (
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>
              {item.time}
            </Text>
          )}
        </View>

        {/* Organizer Info */}
        {(item.organizerName || item.organizerInfo?.name) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              columnGap: 6,
            }}
          >
            <Text style={{ color: COLORS.primary, fontSize: 12 }}>🏢</Text>
            <Text
              style={{ color: COLORS.muted, fontSize: 12 }}
              numberOfLines={1}
            >
              {item.organizerInfo?.name || item.organizerName}
            </Text>
          </View>
        )}

        {/* Rating */}
        {item.rating && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              columnGap: 4,
            }}
          >
            <Text style={{ color: "#ffd700", fontSize: 12 }}>⭐</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>
              {item.rating}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[LAYOUT.screen, LAYOUT.center]}>
        <Text style={TYPO.body}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={LAYOUT.screen}
      contentContainerStyle={{ paddingBottom: SPACING.xl + 10 }}
    >
      {/* Top header: current location + profile avatar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: SPACING.lg,
        }}
      >
        <View>
          <Text style={[TYPO.muted, { marginBottom: 2 }]}>Location</Text>
          <Text style={TYPO.h2} numberOfLines={1}>
            {locationLabel}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/user/settings")}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Image
            source={require("../../assets/images/placeholer.png")}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
        </TouchableOpacity>
      </View>
      {/* Featured / Trending banner */}
      {trending ? (
        <View style={{ marginBottom: SPACING.lg }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={{
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#213336",
            }}
            onPress={() => {
              setSelectedEvent(trending);
              setModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open details for ${trending.title}`}
          >
            {trending.image ? (
              <Image
                source={{ uri: trending.image }}
                style={{ width: "100%", height: 200 }}
              />
            ) : (
              <View
                style={[
                  LAYOUT.center,
                  { height: 200, backgroundColor: "#0F1A1C" },
                ]}
              >
                <Text style={TYPO.h2}>{trending.title}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ marginTop: 10 }}>
            <Text style={TYPO.h2} numberOfLines={1}>
              {trending.title}
            </Text>
            {trending.description || trending.desc ? (
              <Text style={TYPO.muted} numberOfLines={2}>
                {trending.description ?? trending.desc}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Time-based sections */}
      {Object.entries(eventsByTimePeriod).map(([period, items]) => (
        <View key={period} style={{ marginBottom: SPACING.xl }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={TYPO.h2}>{period}</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/user/events",
                  params: {
                    timeFilter: period.toLowerCase().replace(" ", "_"),
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`See all ${period} events`}
            >
              <Text style={TYPO.link}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row" }}>
              {items.map(renderEventCard)}
            </View>
          </ScrollView>
        </View>
      ))}

      {/* Category sections */}
      {categories.map((cat) => {
        const items =
          eventsByCategory[cat._id] || eventsByCategory[cat.key] || [];
        if (!items.length) return null;
        const heading =
          cat.label || (typeof cat.name === "string" ? cat.name : "");
        return (
          <View key={cat._id || cat.key} style={{ marginBottom: SPACING.xl }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text style={TYPO.h2}>{heading}</Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/user/events",
                    params: { categoryId: cat._id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`See all ${heading} events`}
              >
                <Text style={TYPO.link}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row" }}>
                {items.map(renderEventCard)}
              </View>
            </ScrollView>
          </View>
        );
      })}

      {/* Event details modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 16,
              padding: 18,
              width: "88%",
            }}
          >
            {selectedEvent ? (
              <View>
                {selectedEvent.image ? (
                  <Image
                    source={{ uri: selectedEvent.image }}
                    style={{
                      width: "100%",
                      height: 200,
                      borderRadius: 12,
                      marginBottom: 12,
                    }}
                  />
                ) : null}
                <Text
                  style={{
                    color: COLORS.backgroundn,
                    fontSize: 20,
                    fontWeight: "800",
                    marginBottom: 8,
                  }}
                  numberOfLines={2}
                >
                  {selectedEvent.title}
                </Text>
                {selectedEvent.description || (selectedEvent as any).desc ? (
                  <Text
                    style={{
                      color: COLORS.muted,
                      fontSize: 15,
                      lineHeight: 22,
                      marginBottom: 10,
                    }}
                  >
                    {selectedEvent.description ?? (selectedEvent as any).desc}
                  </Text>
                ) : null}
                <View style={{ rowGap: 6, marginTop: 4 }}>
                  {!!selectedEvent.date && (
                    <Text style={{ color: COLORS.muted }}>
                      🗓 {new Date(selectedEvent.date).toDateString()}
                    </Text>
                  )}
                  {!!selectedEvent.time && (
                    <Text style={{ color: COLORS.muted }}>
                      ⏰ {selectedEvent.time}
                    </Text>
                  )}

                  {/* Organizer Info */}
                  {(selectedEvent.organizerName ||
                    selectedEvent.organizerInfo?.name) && (
                    <Text style={{ color: COLORS.muted }}>
                      🏢{" "}
                      {selectedEvent.organizerInfo?.name ||
                        selectedEvent.organizerName}
                    </Text>
                  )}

                  {/* Rating */}
                  {selectedEvent.rating && (
                    <Text style={{ color: COLORS.muted }}>
                      ⭐ Rating: {selectedEvent.rating}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <Text style={{ color: "red" }}>No event selected</Text>
            )}

            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: "#FFD700",
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
              onPress={() => {
                setShowRatingModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Rate this event"
            >
              <Text style={{ color: COLORS.backgroundd, fontWeight: "800" }}>
                ⭐ Rate This Event
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                marginTop: 12,
                backgroundColor: COLORS.primary,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
              onPress={() => {
                setModalVisible(false);
                setSelectedEvent(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close event details"
            >
              <Text style={{ color: COLORS.backgroundd, fontWeight: "800" }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      {selectedEvent && (
        <ReviewModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          eventId={selectedEvent._id}
          eventDateISO={selectedEvent.date}
          eventTime={selectedEvent.time}
          isAuthenticated={isAuthenticated}
          isEngaged={true}
          onEngaged={() => {}}
        />
      )}
    </ScrollView>
  );
}
