package com.afterlifebureaucracy.game;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import java.nio.charset.StandardCharsets;

/**
 * Play Games Services saved games (snapshots), exposed to the web layer as the `CloudSave`
 * Capacitor plugin and wrapped by `src/platform/cloudSave.ts`.
 *
 * Sign-in runs through the same `GamesSignInClient` that
 * `@openforge/capacitor-game-connect` uses, so this plugin shares its authentication state
 * with achievements and leaderboards rather than prompting the player a second time.
 *
 * Every method resolves or rejects exactly once; the TypeScript wrapper turns a rejection
 * into a result union, so a failure here never surfaces as a thrown error in the game.
 */
@CapacitorPlugin(name = "CloudSave")
public class CloudSavePlugin extends Plugin {
  private static final int POLICY = SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED;

  @PluginMethod
  public void isAuthenticated(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t -> {
      JSObject r = new JSObject();
      r.put("value", t.isSuccessful() && t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  @PluginMethod
  public void signIn(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t -> {
      JSObject r = new JSObject();
      r.put("value", t.isSuccessful() && t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  @PluginMethod
  public void loadSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(t -> {
      try {
        if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
        Snapshot snap = t.getResult().getData();
        byte[] bytes = snap == null ? null : snap.getSnapshotContents().readFully();
        JSObject r = new JSObject();
        if (bytes == null || bytes.length == 0) { r.put("found", false); }
        else {
          r.put("found", true);
          r.put("data", new String(bytes, StandardCharsets.UTF_8));
          r.put("savedAtWall", snap.getMetadata().getLastModifiedTimestamp());
        }
        if (snap != null) client.discardAndClose(snap);
        call.resolve(r);
      } catch (Exception e) { call.reject("read failed", e); }
    });
  }

  @PluginMethod
  public void saveSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    String data = call.getString("data", "");
    String description = call.getString("description", "");
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(t -> {
      if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
      Snapshot snap = t.getResult().getData();
      if (snap == null) { call.reject("no snapshot"); return; }
      snap.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
      SnapshotMetadataChange change = new SnapshotMetadataChange.Builder().setDescription(description).build();
      client.commitAndClose(snap, change).addOnCompleteListener(c -> {
        if (c.isSuccessful()) call.resolve(); else call.reject("commit failed", c.getException());
      });
    });
  }
}
