"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAnalyticsPath, isProductionAnalyticsHost } from "../lib/analytics-config";
import { updateAnalyticsLocation } from "../lib/analytics";

const GOOGLE_TAG_MANAGER_ID = "GTM-WBMHCBXJ";
const GOOGLE_ANALYTICS_ID = "G-31J209RFN1";

export function GoogleTagManager() {
  const pathname = usePathname();
  const enabled = isAnalyticsPath(pathname);

  useEffect(() => {
    // GTM stays in memory during Next.js client-side navigation. This flag also
    // stops GA4 after a visitor moves from a measured page to an excluded one.
    const analyticsWindow = window as unknown as Record<string, unknown>;
    analyticsWindow[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = !enabled || !isProductionAnalyticsHost(window.location.hostname);
    updateAnalyticsLocation();
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`(function(w,d,s,l,i){if(w.location.hostname!=='www.wanmemory.com'&&w.location.hostname!=='wanmemory.com')return;w[l]=w[l]||[];w.gtag=w.gtag||function(){w[l].push(arguments)};var u=new URL(w.location.href),p=new URLSearchParams(),r='';if(['/auth','/studio','/story','/start'].indexOf(u.pathname)===-1){['utm_source','utm_medium','utm_campaign','utm_content','gclid','gbraid','wbraid'].forEach(function(k){var v=u.searchParams.get(k);if(v&&/^[A-Za-z0-9._~+-]{1,200}$/.test(v))p.set(k,v)})}try{var ref=new URL(d.referrer);if(ref.protocol==='https:'||ref.protocol==='http:'){if(ref.origin!==u.origin&&['wanmemory.com','www.wanmemory.com'].indexOf(ref.hostname)===-1){r=ref.origin}else{var first=ref.pathname.split('/').filter(Boolean)[0],known=['aiken-omoide-douga','aiken-shashin-douga','aiken-shashin-seiri','api','auth','contact','dog-photo-guide','film','legal','privacy','story','start','studio','terms','uchinoko-kinenbi-douga'];if((!first||known.indexOf(first)!==-1)&&(first!=='film'||ref.pathname==='/film/moka-demo'))r=ref.origin+ref.pathname}}}catch(e){}w.gtag('set',{page_location:u.origin+u.pathname+(p.toString()?'?'+p:''),page_referrer:r});w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');`}
    </Script>
  );
}
