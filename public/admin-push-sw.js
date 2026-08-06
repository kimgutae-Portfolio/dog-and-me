self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "WAN MEMORY", body: "管理画面を確認してください。" };
  }

  const title = data.title || "WAN MEMORY";
  const options = {
    body: data.body || "管理画面を確認してください。",
    icon: "/icon",
    badge: "/icon",
    tag: data.notificationId || "wan-memory-admin",
    data: { href: data.href || "/admin", notificationId: data.notificationId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(href);
        return existing.focus();
      }
      return self.clients.openWindow(href);
    }),
  );
});
