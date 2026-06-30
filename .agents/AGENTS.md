# Header Height Rule

DO NOT modify the `paddingTop` values of the `Animated.ScrollView` in the screens (`DashboardScreen`, `RiwayatScreen`, `LeaderboardScreen`, `KalkulatorScreen`, `EdukasiScreen`, `ProfileScreen`) that control the spacing under the animated top header. 
The user explicitly requested that the header spacing (`insets.top + HEADER_HEIGHT - 5`) remain consistent and unchanged moving forward.
