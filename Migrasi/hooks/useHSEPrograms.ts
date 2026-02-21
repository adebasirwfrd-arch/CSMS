import { useState } from 'react';

export function useHSEPrograms({ region, base, category, year }: any) {
    const [data] = useState({ programs: [] });
    return { data, isLoading: false, isError: false };
}

export function useUpdateProgramMonth() {
    return { mutate: () => console.log('Update mocked'), isPending: false };
}

export function useCreateProgram() {
    return { mutate: () => console.log('Create mocked'), isPending: false };
}

export function useDeleteProgram() {
    return { mutate: () => console.log('Delete mocked'), isPending: false };
}
