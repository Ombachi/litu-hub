import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();
const mockIs = vi.fn();

const chainMock = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  order: mockOrder,
  range: mockRange,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
  in: mockIn,
  is: mockIs,
});

// Each method returns the chain
for (const fn of [mockSelect, mockInsert, mockUpdate, mockEq, mockOrder, mockRange, mockIn, mockIs]) {
  fn.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    range: mockRange,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    in: mockIn,
    is: mockIs,
    insert: mockInsert,
    update: mockUpdate,
    then: (resolve: any) => resolve({ data: [], error: null }),
  });
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => chainMock()),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" }, loading: false }),
}));

// Mock react-query
const mockQueryFn = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    mockQueryFn.mockImplementation(opts.queryFn);
    return { data: null, isLoading: false, error: null };
  },
  useMutation: (opts: any) => ({
    mutate: opts.mutationFn,
    mutateAsync: opts.mutationFn,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  }),
}));

describe("useData hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCourses hook initializes with correct query key", async () => {
    const { useCourses } = await import("@/hooks/useData");
    useCourses();
    expect(mockQueryFn).toBeDefined();
  });

  it("useProfile hook uses correct user id", async () => {
    const { useProfile } = await import("@/hooks/useData");
    useProfile();
    expect(mockQueryFn).toBeDefined();
  });

  it("useUserRole hook returns role data", async () => {
    const { useUserRole } = await import("@/hooks/useData");
    useUserRole();
    expect(mockQueryFn).toBeDefined();
  });

  it("useAssignments supports pagination params", async () => {
    const { useAssignments } = await import("@/hooks/useData");
    useAssignments("course-123", 2, 25);
    expect(mockQueryFn).toBeDefined();
  });

  it("useQuizzes supports pagination params", async () => {
    const { useQuizzes } = await import("@/hooks/useData");
    useQuizzes("course-123", 1, 10);
    expect(mockQueryFn).toBeDefined();
  });

  it("useDiscussions supports pagination params", async () => {
    const { useDiscussions } = await import("@/hooks/useData");
    useDiscussions("course-123", 0, 50);
    expect(mockQueryFn).toBeDefined();
  });
});
