import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncBody {
  client_id?: string;
  lookback_days?: number;
}

interface MetaMetric {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ value: string }>;
  date_start: string;
  date_stop: string;
  objective?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = Deno.env.get('META_SYSTEM_USER_TOKEN');
    if (!token) {
      throw new Error("META_SYSTEM_USER_TOKEN secret is not set");
    }

    let client_id: string | undefined;
    let lookback_days = 7;

    try {
      const text = await req.text();
      const body: SyncBody = text ? JSON.parse(text) : {};
      client_id = body.client_id;
      if (body.lookback_days) lookback_days = body.lookback_days;
    } catch {
      console.log('[sync-meta-ads] Chamada sem body ou body inválido');
    }

    let query = supabase.from('meta_ad_accounts').select('*').eq('status', 'active');
    if (client_id) query = query.eq('client_id', client_id);

    const { data: accounts, error: errAccounts } = await query;
    if (errAccounts) throw errAccounts;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No active accounts to sync" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const sinceDate = lookback_days === 1 
      ? today 
      : new Date(Date.now() - lookback_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const timeRange = JSON.stringify({ since: sinceDate, until: today });

    let metricsInserted = 0;

    for (const account of accounts) {
      try {
        const formattedAccountId = account.ad_account_id.startsWith('act_') ? account.ad_account_id : `act_${account.ad_account_id}`;
        
        // --- 1. Fetch Ads with Creatives for Thumbnails ---
        console.log(`[sync-meta-ads] Buscando Ads e criativos para conta ${account.ad_account_id}...`);
        const adsUrl = `https://graph.facebook.com/v25.0/${formattedAccountId}/ads?fields=id,name,adset_id,campaign_id,creative{thumbnail_url,image_url,video_id}&access_token=${token}&limit=500`;
        const adsRes = await fetch(adsUrl);
        const adsData = await adsRes.json();
        
        const adCreativesMap = new Map<string, string>();
        if (adsData.data) {
          for (const ad of adsData.data) {
            const thumbnail = ad.creative?.thumbnail_url || ad.creative?.image_url;
            if (thumbnail) {
              adCreativesMap.set(ad.id, thumbnail);
            }
          }
        }

        // --- 2. Fetch Insights Levels (campaign, adset, ad) ---
        const levels = ['campaign', 'adset', 'ad'];
        const timeIncrement = '&time_increment=1';

        for (const level of levels) {
          console.log(`[sync-meta-ads] Buscando Insights nível: ${level}`);
          
          let levelFields = 'campaign_id,campaign_name,objective';
          if (level === 'adset') levelFields += ',adset_id,adset_name';
          if (level === 'ad') levelFields += ',adset_id,adset_name,ad_id,ad_name';
          
          const insightsUrl = `https://graph.facebook.com/v25.0/${formattedAccountId}/insights?level=${level}&time_range=${timeRange}&fields=${levelFields},impressions,clicks,spend,reach,cpc,cpm,ctr,actions,purchase_roas,date_start,date_stop${timeIncrement}&access_token=${token}&limit=500`;
          
          const insRes = await fetch(insightsUrl);
          const insData = await insRes.json();

          if (insData.error) {
            console.error(`[sync-meta-ads] Erro Insights ${level} para ${formattedAccountId}:`, insData.error.message);
            continue;
          }

          const metricsList = (insData.data || []) as MetaMetric[];
          console.log(`[sync-meta-ads] Recebidos ${metricsList.length} registros (nível ${level}).`);

          for (const metric of metricsList) {
            
            // 2.1 Sync Campaign Entity
            const { data: existingCamp } = await supabase
              .from('traffic_campaigns')
              .select('id')
              .eq('client_id', account.client_id)
              .eq('meta_campaign_id', metric.campaign_id)
              .maybeSingle();

            let localCampId: string;
            const campPayload = {
              name: metric.campaign_name,
              platform: 'meta',
              objective: metric.objective || 'UNKNOWN',
              updated_at: new Date().toISOString()
            };

            if (existingCamp) {
              localCampId = existingCamp.id;
              await supabase.from('traffic_campaigns').update(campPayload).eq('id', localCampId);
            } else {
              const { data: newCamp, error: insError } = await supabase.from('traffic_campaigns').insert({
                ...campPayload,
                client_id: account.client_id,
                meta_account_id: account.id,
                meta_campaign_id: metric.campaign_id,
                status: 'active'
              }).select().single();
              if (insError) continue;
              localCampId = newCamp.id;
            }

            // 2.2 Sync AdSet Entity (if applicable)
            let localAdsetId: string | undefined = undefined;
            if ((level === 'adset' || level === 'ad') && metric.adset_id && metric.adset_name) {
               const { data: existingAdset } = await supabase
                .from('traffic_ad_sets')
                .select('id')
                .eq('client_id', account.client_id)
                .eq('meta_adset_id', metric.adset_id)
                .maybeSingle();
                
               const adsetPayload = {
                 name: metric.adset_name,
                 campaign_id: localCampId,
                 updated_at: new Date().toISOString()
               };
               
               if (existingAdset) {
                 localAdsetId = existingAdset.id;
                 await supabase.from('traffic_ad_sets').update(adsetPayload).eq('id', localAdsetId);
               } else {
                 const { data: newAdset, error: errAdset } = await supabase.from('traffic_ad_sets').insert({
                   ...adsetPayload,
                   client_id: account.client_id,
                   meta_adset_id: metric.adset_id,
                 }).select().single();
                 if (!errAdset) localAdsetId = newAdset.id;
               }
            }

            // 2.3 Sync Ad Entity (if applicable)
            let localAdId: string | undefined = undefined;
            if (level === 'ad' && metric.ad_id && metric.ad_name && localAdsetId) {
               const { data: existingAd } = await supabase
                .from('traffic_ads')
                .select('id')
                .eq('client_id', account.client_id)
                .eq('external_id', metric.ad_id)
                .maybeSingle();
                
               const adPayload = {
                 name: metric.ad_name,
                 campaign_id: localCampId,
                 adset_id: localAdsetId,
                 thumbnail_url: adCreativesMap.get(metric.ad_id) || null,
                 updated_at: new Date().toISOString()
               };
               
               if (existingAd) {
                 localAdId = existingAd.id;
                 await supabase.from('traffic_ads').update(adPayload).eq('id', localAdId);
               } else {
                 const { data: newAd, error: errAd } = await supabase.from('traffic_ads').insert({
                   ...adPayload,
                   client_id: account.client_id,
                   external_id: metric.ad_id,
                 }).select().single();
                 if (!errAd) localAdId = newAd.id;
               }
            }

            // 2.4 Parse Metrics & Conversions
            let conversions = 0;
            let roas = 0;
            
            if (metric.actions && Array.isArray(metric.actions)) {
               const messageActions = metric.actions.filter(a => 
                 a.action_type.includes('messaging') ||
                 a.action_type === 'lead' || 
                 a.action_type === 'purchase' || 
                 a.action_type === 'offsite_conversion.fb_pixel_lead'
               );

               const messagingActions = messageActions.filter(a => 
                 ['onsite_conversion.total_messaging_connection', 
                  'onsite_messaging_conversation_started', 
                  'onsite_conversion.messaging_conversation_started_7d',
                  'messaging_conversation_started_7d'
                 ].includes(a.action_type)
               );
               
               const primaryMessaging = messagingActions.find(a => 
                 a.action_type === 'onsite_conversion.messaging_conversation_started_7d' || 
                 a.action_type === 'messaging_conversation_started_7d' ||
                 a.action_type === 'onsite_messaging_conversation_started'
               );
               
               const maxMessaging = primaryMessaging 
                 ? parseInt(primaryMessaging.value) 
                 : (messagingActions.length > 0 ? Math.max(...messagingActions.map(a => parseInt(a.value))) : 0);

               const otherConvs = messageActions.filter(a => ['lead', 'purchase', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type));
               const maxOthers = otherConvs.length > 0 
                 ? Math.max(...otherConvs.map(a => parseInt(a.value))) 
                 : 0;

               conversions = Math.max(maxMessaging, maxOthers);
            }

            if (metric.purchase_roas && Array.isArray(metric.purchase_roas) && metric.purchase_roas.length > 0) {
               roas = parseFloat(metric.purchase_roas[0].value);
            }

            const metricPayload = {
               client_id: account.client_id,
               campaign_id: localCampId,
               adset_id: localAdsetId,
               ad_id: localAdId,
               level: level,
               date: metric.date_start,
               impressions: parseInt(metric.impressions || '0'),
               clicks: parseInt(metric.clicks || '0'),
               spend: parseFloat(metric.spend || '0'),
               reach: parseInt(metric.reach || '0'),
               cpc: parseFloat(metric.cpc || '0'),
               cpm: parseFloat(metric.cpm || '0'),
               ctr: parseFloat(metric.ctr || '0'),
               conversions: conversions,
               roas: roas,
               updated_at: new Date().toISOString(),
               raw_actions: metric.actions || []
            };

            let mQuery = supabase.from('traffic_metrics').select('id')
               .eq('client_id', account.client_id)
               .eq('date', metric.date_start)
               .eq('level', level);

            if (level === 'campaign') mQuery = mQuery.eq('campaign_id', localCampId);
            if (level === 'adset') mQuery = mQuery.eq('adset_id', localAdsetId);
            if (level === 'ad') mQuery = mQuery.eq('ad_id', localAdId);

            const { data: extM } = await mQuery.maybeSingle();

            if (extM) {
               await supabase.from('traffic_metrics').update(metricPayload).eq('id', extM.id);
               metricsInserted++;
            } else {
               const { error: insErr } = await supabase.from('traffic_metrics').insert(metricPayload);
               if (!insErr) metricsInserted++;
            }
          }
        }
        await supabase.from('meta_ad_accounts').update({ last_sync_at: new Date().toISOString() }).eq('id', account.id);
      } catch (accountErr: any) {
        console.error(`[sync-meta-ads] Falha na conta ${account.ad_account_id}:`, accountErr.message);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Sincronização completa (Campanha, Conjunto, Anúncio) concluída! ${metricsInserted} registros processados.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
