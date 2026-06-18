const NOTION_TOKEN = process.env.NOTION_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;
const WHATSAPP_APIKEY = process.env.WHATSAPP_APIKEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const CONTRACTS_DB = '21f3ac9a-94fb-47a5-b0a6-91f706754f0e';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Security: only allow Vercel Cron or manual trigger with secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch all active contracts from Notion
    const response = await fetch(`https://api.notion.com/v1/databases/${CONTRACTS_DB}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: 'حالة العقد | Status',
          select: { equals: 'ساري | Active' }
        }
      })
    });

    const data = await response.json();
    if (!data.results) return res.status(500).json({ error: 'Notion error', details: data });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts = [];

    for (const page of data.results) {
      const p = page.properties;
      const contractNo   = p['رقم العقد | Contract No']?.title?.[0]?.plain_text || '';
      const tenant       = p['اسم المستأجر/المشتري | Tenant/Buyer']?.rich_text?.[0]?.plain_text || '';
      const property     = p['اسم العقار | Property Name']?.rich_text?.[0]?.plain_text || '';
      const endDateStr   = p['تاريخ النهاية | End Date']?.date?.start || '';
      const payDateStr   = p['الدفعة القادمة | Next Payment Date']?.date?.start || '';
      const remaining    = p['مبلغ متبقي | Remaining (SAR)']?.number || 0;
      const payAmount    = p['قيمة الدفعة | Payment Amount (SAR)']?.number || 0;

      // Check contract expiry (30, 14, 7 days before)
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));

        if ([30, 14, 7].includes(daysLeft)) {
          alerts.push({
            type: 'expiry',
            contractNo,
            tenant,
            property,
            daysLeft,
            endDate: endDateStr,
            remaining
          });
        }
      }

      // Check payment due (3 days before)
      if (payDateStr) {
        const payDate = new Date(payDateStr);
        payDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((payDate - today) / (1000 * 60 * 60 * 24));

        if ([3, 1, 0].includes(daysLeft)) {
          alerts.push({
            type: 'payment',
            contractNo,
            tenant,
            property,
            daysLeft,
            payDate: payDateStr,
            payAmount
          });
        }
      }
    }

    if (alerts.length === 0) {
      return res.status(200).json({ message: 'No alerts today', checked: data.results.length });
    }

    // 2. Build notification content
    const emailLines = [];
    const whatsappLines = ['🏢 *تنبيهات مكتبك العقاري*\n'];

    for (const a of alerts) {
      if (a.type === 'expiry') {
        const msg = `⚠️ عقد ${a.contractNo} (${a.property}) ينتهي خلال ${a.daysLeft} يوم — المستأجر: ${a.tenant} — المبلغ المتبقي: ${a.remaining?.toLocaleString()} ريال`;
        emailLines.push(`<li style="margin-bottom:12px;padding:12px;background:#FFF3CD;border-radius:8px;border-right:4px solid #FFC107">
          <strong>⚠️ عقد ينتهي قريباً</strong><br>
          العقد: ${a.contractNo} | العقار: ${a.property}<br>
          المستأجر: ${a.tenant} | ينتهي: ${a.endDate}<br>
          المتبقي من الأيام: <strong>${a.daysLeft} يوم</strong> | المبلغ المتبقي: ${a.remaining?.toLocaleString()} ريال
        </li>`);
        whatsappLines.push(msg);
      } else {
        const urgency = a.daysLeft === 0 ? '🔴 اليوم!' : a.daysLeft === 1 ? '🟠 غداً' : `🟡 خلال ${a.daysLeft} أيام`;
        const msg = `💰 دفعة عقد ${a.contractNo} (${a.property}) — ${urgency} — المستأجر: ${a.tenant} — المبلغ: ${a.payAmount?.toLocaleString()} ريال`;
        emailLines.push(`<li style="margin-bottom:12px;padding:12px;background:#D4EDDA;border-radius:8px;border-right:4px solid #28A745">
          <strong>💰 دفعة مستحقة</strong><br>
          العقد: ${a.contractNo} | العقار: ${a.property}<br>
          المستأجر: ${a.tenant} | تاريخ الدفعة: ${a.payDate}<br>
          الأولوية: <strong>${urgency}</strong> | المبلغ: ${a.payAmount?.toLocaleString()} ريال
        </li>`);
        whatsappLines.push(msg);
      }
    }

    const results = { alerts: alerts.length, email: null, whatsapp: null };

    // 3. Send Email via Resend
    if (RESEND_API_KEY && NOTIFY_EMAIL) {
      const emailBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Tajawal,Arial,sans-serif;background:#f5f5f5;padding:20px;direction:rtl">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
          <div style="background:linear-gradient(135deg,#1A1A2E,#0F3460);padding:28px;text-align:center">
            <div style="font-size:36px;margin-bottom:8px">🏢</div>
            <h1 style="color:#C9A84C;font-size:20px;margin:0">مكتبي العقاري — الدمام</h1>
            <p style="color:#A8A4A0;font-size:13px;margin-top:6px">تنبيهات يومية | Daily Alerts</p>
          </div>
          <div style="padding:24px">
            <p style="color:#333;font-size:15px">السلام عليكم،<br>لديك <strong>${alerts.length} تنبيه</strong> يحتاج متابعة اليوم:</p>
            <ul style="list-style:none;padding:0;margin:16px 0">${emailLines.join('')}</ul>
            <div style="text-align:center;margin-top:24px">
              <a href="https://real-estate-phi-one-56.vercel.app" style="background:#C9A84C;color:#1A1A2E;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">فتح لوحة التحكم</a>
            </div>
          </div>
          <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#999">
            مكتبي العقاري — الدمام، المنطقة الشرقية
          </div>
        </div>
      </body>
      </html>`;

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Real Estate Office <onboarding@resend.dev>',
            to: [NOTIFY_EMAIL],
            subject: `🏢 ${alerts.length} تنبيه عقاري — ${new Date().toLocaleDateString('ar-SA')}`,
            html: emailBody
          })
        });
        const emailData = await emailRes.json();
        results.email = emailData.id ? 'sent' : emailData;
      } catch(e) {
        results.email = 'error: ' + e.message;
      }
    }

    // 4. Send WhatsApp via CallMeBot
    if (WHATSAPP_PHONE && WHATSAPP_APIKEY) {
      const msg = encodeURIComponent(whatsappLines.join('\n'));
      try {
        const waRes = await fetch(
          `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${msg}&apikey=${WHATSAPP_APIKEY}`
        );
        results.whatsapp = waRes.ok ? 'sent' : 'error: ' + waRes.status;
      } catch(e) {
        results.whatsapp = 'error: ' + e.message;
      }
    }

    res.status(200).json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
