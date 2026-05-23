// Supabase Edge Function: pdpa-cleanup
// ลบไฟล์ที่ครบ retention period (เรียกจาก GitHub Actions ทุกคืน)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT')!)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body   = btoa(JSON.stringify(payload))
  const signingInput = `${header}.${body}`
  const privateKey = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}`
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  return (await res.json()).access_token
}

async function deleteDriveFolder(accessToken: string, folderId: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ตรวจสอบ service key (เฉพาะ cron job เรียกได้)
  const authHeader = req.headers.get('Authorization')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: corsHeaders,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // หาเอกสารที่ครบ retention
    const { data: expiredDocs, error } = await supabase
      .from('guest_documents')
      .select('id, booking_ref, gdrive_folder_id')
      .lte('retention_expires_at', new Date().toISOString())
      .neq('status', 'archived')

    if (error) throw error

    const accessToken = expiredDocs?.length ? await getAccessToken() : null
    let deleted = 0

    for (const doc of expiredDocs || []) {
      try {
        // ลบ folder ใน Google Drive
        if (doc.gdrive_folder_id && accessToken) {
          await deleteDriveFolder(accessToken, doc.gdrive_folder_id)
        }

        // อัปเดต status + ล้าง file IDs (anonymize)
        await supabase.from('guest_documents').update({
          status: 'archived',
          gdrive_folder_id: null,
          gdrive_folder_url: null,
          registration_file_id: null,
          signed_registration_file_id: null,
          passport_file_id: null,
          idcard_file_id: null,
          metadata_file_id: null,
        }).eq('id', doc.id)

        // Audit log
        await supabase.from('audit_logs').insert({
          booking_ref: doc.booking_ref,
          action: 'pdpa_auto_delete',
          resource_type: 'document',
          resource_id: doc.id,
          metadata: { reason: 'retention_expired', timestamp: new Date().toISOString() },
        })

        deleted++
      } catch (docError) {
        console.error(`Failed to delete ${doc.booking_ref}:`, docError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: expiredDocs?.length || 0, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
