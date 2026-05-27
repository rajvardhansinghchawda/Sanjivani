import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Mail, Crown, UserCheck, Trash2 } from 'lucide-react';
import { useFamilyGroups, useCreateFamilyGroup, useInviteFamilyMember } from '@/hooks/useFamily';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

function CreateGroupModal({ onClose }) {
  const [name, setName] = useState('');
  const createGroup = useCreateFamilyGroup();

  const handleSubmit = (e) => {
    e.preventDefault();
    createGroup.mutate({ name }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-xl font-bold mb-4">Create Family Group</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Group Name</label>
            <input
              required autoFocus
              type="text" placeholder="e.g. The Sharma Family"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={createGroup.isPending}>
              {createGroup.isPending ? 'Creating…' : 'Create Group'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function InviteModal({ groupId, onClose }) {
  const [email, setEmail] = useState('');
  const invite = useInviteFamilyMember(groupId);

  const handleSubmit = (e) => {
    e.preventDefault();
    invite.mutate({ email }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
      >
        <h2 className="text-xl font-bold mb-4">Invite Family Member</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email Address</label>
            <input
              required autoFocus
              type="email" placeholder="member@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function GroupCard({ group }) {
  const [showInvite, setShowInvite] = useState(false);
  const members = group.members || [];

  return (
    <>
      <Card className="border-border/50 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setShowInvite(true)}>
              <Plus className="w-3 h-3" /> Invite
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {members.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-border/60 rounded-xl">
              <Mail className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No members yet. Invite your family!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {members.map((member, i) => (
                <div key={member.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {(member.full_name || member.email || 'M')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{member.full_name || member.email}</p>
                    {member.email && member.full_name && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {member.is_admin ? (
                      <Badge variant="primary" className="gap-1 text-xs">
                        <Crown className="w-3 h-3" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <UserCheck className="w-3 h-3" /> Member
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showInvite && <InviteModal groupId={group.id} onClose={() => setShowInvite(false)} />}
    </>
  );
}

export default function FamilyGroups() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: groupsData, isLoading } = useFamilyGroups();
  const groups = Array.isArray(groupsData) ? groupsData : (groupsData?.data ?? groupsData?.results ?? []);

  return (
    <div className="flex flex-col gap-8 py-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Family Groups</h1>
          <p className="text-muted-foreground mt-1">Share your adherence journey with the people you love.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-muted/40 border-0" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-2xl bg-card">
          <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No family groups yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create a family group to share your medication adherence progress with your loved ones.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Your First Group
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group, idx) => (
            <motion.div key={group.id || idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
              <GroupCard group={group} />
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
