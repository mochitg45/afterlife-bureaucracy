package com.afterlifebureaucracy.game;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageManager;
import android.os.Bundle;
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
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

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

  /**
   * Snapshot completion callbacks run here, not on the main thread. `readFully()` and
   * `writeBytes()` touch the snapshot file, and the single-argument `addOnCompleteListener`
   * would run them on the UI thread — jank on a slow device, an ANR on a large save.
   *
   * Single-threaded on purpose: it also serialises opens, so a save and a load can never hold
   * the same snapshot open at once. Nothing on this thread touches the Activity or any view;
   * `call.resolve`/`call.reject` are thread-safe in Capacitor.
   */
  private static final Executor IO = Executors.newSingleThreadExecutor();

  /**
   * Whether this build has a Play Games app id at all. `Capacitor.getPlatform()` only says
   * "Android"; a build with the `APP_ID` meta-data commented out has no cloud slot, and the
   * web layer has to be able to tell the two apart -- "not available here" and "not signed
   * in" send a player to very different places.
   */
  @PluginMethod
  public void isConfigured(PluginCall call) {
    boolean configured = false;
    try {
      Context ctx = getContext();
      Bundle meta = ctx.getPackageManager()
        .getApplicationInfo(ctx.getPackageName(), PackageManager.GET_META_DATA).metaData;
      configured = meta != null && meta.containsKey("com.google.android.gms.games.APP_ID");
    } catch (Exception e) {
      configured = false;
    }
    JSObject r = new JSObject();
    r.put("value", configured);
    call.resolve(r);
  }

  @PluginMethod
  public void isAuthenticated(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t -> {
      // A task that failed is not a signed-out player: it is a question that was never
      // answered, and the wrapper must be free to treat the two differently.
      if (!t.isSuccessful()) { call.reject("auth check failed", t.getException()); return; }
      JSObject r = new JSObject();
      r.put("value", t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  @PluginMethod
  public void signIn(PluginCall call) {
    PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t -> {
      // Backing out of the prompt succeeds with `isAuthenticated() == false` (a cancel); a
      // failed task means the prompt could not run at all, which is 'unavailable'.
      if (!t.isSuccessful()) { call.reject("sign-in failed", t.getException()); return; }
      JSObject r = new JSObject();
      r.put("value", t.getResult().isAuthenticated());
      call.resolve(r);
    });
  }

  /** The signed-in player's display name, or null: Settings shows it so a shared phone knows whose desk this is. */
  @PluginMethod
  public void currentPlayer(PluginCall call) {
    PlayGames.getPlayersClient(getActivity()).getCurrentPlayer().addOnCompleteListener(t -> {
      JSObject r = new JSObject();
      r.put("name", t.isSuccessful() && t.getResult() != null ? t.getResult().getDisplayName() : null);
      call.resolve(r);
    });
  }

  /**
   * Play Games Services v2 has no in-app account picker: the account is whichever one the
   * Google Play Games app holds as default. So "change account" opens that app (or its store
   * page if it is missing); the store re-checks sign-in when this app comes back.
   */
  @PluginMethod
  public void openAccountSettings(PluginCall call) {
    Intent i = getActivity().getPackageManager().getLaunchIntentForPackage("com.google.android.play.games");
    if (i == null) i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.play.games"));
    getActivity().startActivity(i);
    call.resolve();
  }

  @PluginMethod
  public void loadSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(IO, t -> {
      try {
        if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
        Snapshot snap = t.getResult().getData();
        // A slot that opened without data is a read that did not happen, never an empty slot:
        // reporting "empty" here would invite an upload over a cloud copy nobody could see.
        if (snap == null) { call.reject("no snapshot"); return; }
        byte[] bytes = snap.getSnapshotContents().readFully();
        JSObject r = new JSObject();
        if (bytes == null || bytes.length == 0) { r.put("found", false); }
        else {
          r.put("found", true);
          r.put("data", new String(bytes, StandardCharsets.UTF_8));
          r.put("savedAtWall", snap.getMetadata().getLastModifiedTimestamp());
        }
        client.discardAndClose(snap);
        call.resolve(r);
      } catch (Exception e) { call.reject("read failed", e); }
    });
  }

  @PluginMethod
  public void saveSnapshot(PluginCall call) {
    String name = call.getString("name", "afterlife-main");
    String data = call.getString("data", "");
    String description = call.getString("description", "");
    // `savedAtWall` is accepted for symmetry with loadSnapshot but deliberately unused: the
    // SDK stamps its own last-modified time on commit, and that is what loadSnapshot reads back.
    SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
    client.open(name, true, POLICY).addOnCompleteListener(IO, t -> {
      // Everything below can throw -- writeBytes on a closed snapshot, a commit the SDK
      // refuses to start -- and a throw on this executor would leave the call unanswered and
      // the store's `syncing` flag stuck on for the rest of the session.
      try {
        if (!t.isSuccessful()) { call.reject("open failed", t.getException()); return; }
        Snapshot snap = t.getResult().getData();
        if (snap == null) { call.reject("no snapshot"); return; }
        snap.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
        SnapshotMetadataChange change = new SnapshotMetadataChange.Builder().setDescription(description).build();
        client.commitAndClose(snap, change).addOnCompleteListener(IO, c -> {
          try {
            if (c.isSuccessful()) call.resolve(); else call.reject("commit failed", c.getException());
          } catch (Exception e) { call.reject("commit failed", e); }
        });
      } catch (Exception e) { call.reject("write failed", e); }
    });
  }
}
