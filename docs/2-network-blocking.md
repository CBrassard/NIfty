# Step 2 – Block ads at the network (optional)

Samsung's home screen ads and telemetry come from Samsung servers. A DNS filter
on your home network can block them without touching the TV.

Options, easiest first:

1. **NextDNS** (hosted, free tier). Create a profile, enable the
   *Samsung* entry in **Privacy → Native Tracking Protection**, and set the
   DNS address it gives you on the TV (Settings → General → Network →
   Network Status → IP Settings → DNS Setting → Enter manually) or on your router.
2. **Pi-hole** or **AdGuard Home** on a Raspberry Pi / home server, then add
   [`samsung-blocklist.txt`](../network/samsung-blocklist.txt) from this repo
   as a blocklist. In Pi-hole, go to Adlists, add it, then run **Update Gravity**.

## What will and won't break

The list in this repo only covers ads, tracking and ACR. It leaves alone the
hosts that the app store, app logins and firmware updates need. If something
stops working anyway (e.g. an app won't sign in), open your DNS filter's query
log, find the blocked `samsung*` domain the TV just asked for, and allow it.

Do **not** block these unless you're happy to lose the app store and updates:

```
samsungcloudsolution.com
samsungcloudsolution.net
samsungotn.net
samsungqbe.com
samsungosp.com
```

Blocklists stop working when Samsung changes its servers. Check your DNS
filter's query log now and then.
