import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { familyAgent } from '@/agents/family.agent';

export const familyKeys = {
  all: () => ['family'],
  groups: () => ['family', 'groups'],
  group: (id) => ['family', 'group', id],
};

export const useFamilyGroups = () => {
  return useQuery({
    queryKey: familyKeys.groups(),
    queryFn: () => familyAgent.getGroups(),
  });
};

export const useCreateFamilyGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => familyAgent.createGroup(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.groups() });
    },
  });
};

export const useInviteFamilyMember = (groupId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => familyAgent.inviteMember(groupId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.group(groupId) });
    },
  });
};
