package com.afterlifebureaucracy.game;

import android.provider.Settings;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * The two device facts the referral check needs, exposed to the web layer as the `Referral`
 * Capacitor plugin and wrapped by `src/platform/referral.ts`: the Play install referrer (the
 * `referrer=ref%3DCODE` of the invite link) and a one-way hash of the device id.
 *
 * Both methods resolve or reject exactly once; the TypeScript wrapper turns a rejection into
 * 'error', so a failure here never surfaces as a thrown error in the game.
 */
@CapacitorPlugin(name = "Referral")
public class ReferralPlugin extends Plugin {

  /** `{referrer: string|null}`: null when the install carried no referrer. */
  @PluginMethod
  public void getInstallReferrer(PluginCall call) {
    final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
    try {
      client.startConnection(new InstallReferrerStateListener() {
        @Override
        public void onInstallReferrerSetupFinished(int responseCode) {
          try {
            if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
              String referrer = client.getInstallReferrer().getInstallReferrer();
              JSObject r = new JSObject();
              r.put("referrer", referrer == null || referrer.isEmpty() ? null : referrer);
              call.resolve(r);
            } else if (responseCode == InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED) {
              // This Play version cannot say; that is "no referrer", not a failure to retry.
              JSObject r = new JSObject();
              r.put("referrer", null);
              call.resolve(r);
            } else {
              call.reject("install referrer unavailable (" + responseCode + ")");
            }
          } catch (Exception e) {
            call.reject("install referrer failed", e);
          } finally {
            try { client.endConnection(); } catch (Exception ignored) { }
          }
        }

        @Override
        public void onInstallReferrerServiceDisconnected() {
          // Nothing to do: the call is answered in setup-finished, or not at all (the web
          // layer's own timeout covers a service that never answers).
        }
      });
    } catch (Exception e) {
      call.reject("install referrer failed", e);
    }
  }

  /** `{hash}`: SHA-256 hex of ANDROID_ID, so the raw id never leaves the device. */
  @PluginMethod
  public void getDeviceHash(PluginCall call) {
    try {
      String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
      if (id == null || id.isEmpty()) { call.reject("no device id"); return; }
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : digest) hex.append(String.format("%02x", b));
      JSObject r = new JSObject();
      r.put("hash", hex.toString());
      call.resolve(r);
    } catch (Exception e) {
      call.reject("device hash failed", e);
    }
  }
}
