package com.afterlifebureaucracy.game;

import android.content.Context;
import android.os.Bundle;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    muteAnalyticsOnTestLab();
    // In-repo plugins must be registered before the bridge starts.
    registerPlugin(CloudSavePlugin.class);
    registerPlugin(ReferralPlugin.class);
    super.onCreate(savedInstanceState);
  }

  /**
   * Play's pre-launch report robots (Firebase Test Lab) would otherwise show up in Analytics as
   * players with no country. Firebase only reaches the app through the Capacitor plugin, so it is
   * called by reflection rather than adding a compile dependency here.
   */
  private void muteAnalyticsOnTestLab() {
    if (!"true".equals(Settings.System.getString(getContentResolver(), "firebase.test.lab"))) return;
    try {
      Class<?> fa = Class.forName("com.google.firebase.analytics.FirebaseAnalytics");
      Object instance = fa.getMethod("getInstance", Context.class).invoke(null, this);
      fa.getMethod("setAnalyticsCollectionEnabled", boolean.class).invoke(instance, false);
    } catch (Exception ignored) {
      // Analytics missing or renamed: nothing to mute.
    }
  }
}
