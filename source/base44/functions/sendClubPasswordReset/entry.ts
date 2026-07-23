import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { club_id } = await req.json();

    if (!club_id) {
      return Response.json({ error: 'club_id is required' }, { status: 400 });
    }

    const clubs = await base44.asServiceRole.entities.Club.filter({ id: club_id });
    const club = clubs[0];

    if (!club) {
      return Response.json({ error: 'Club not found' }, { status: 404 });
    }

    if (!club.owner_email) {
      return Response.json({ error: 'No owner email found for this club' }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: club.owner_email,
      subject: `Your Club Portal Password — ${club.name}`,
      body: `Hi,\n\nYour Club Portal access password for "${club.name}" is:\n\n${club.club_password || '(not set)'}\n\nIf you'd like to change it, please go to Club Portal > Settings.\n\nBest,\n1COM Team`
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});