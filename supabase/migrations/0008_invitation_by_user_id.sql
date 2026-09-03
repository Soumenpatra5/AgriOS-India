-- Farm Space invitations by AgriOS User ID need neither a phone nor an
-- email on file for the invitee — that is the entire point (see
-- 0007_agrios_user_id.sql). The original constraint required one of the two,
-- written before invited_user_id existed; it is widened here to also accept
-- an invitation that identifies its target directly by user id.

alter table farm_space_invitations drop constraint if exists invitation_has_contact;
alter table farm_space_invitations add constraint invitation_has_contact
  check (phone is not null or email is not null or invited_user_id is not null);
