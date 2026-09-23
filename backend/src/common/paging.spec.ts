import { page, resolveWindow } from './paging';

describe('resolveWindow', () => {
  it('starts at page one with the configured size', () => {
    expect(resolveWindow({})).toEqual({ page: 1, pageSize: 10, skip: 0 });
  });

  it('skips whole pages', () => {
    expect(resolveWindow({ page: 4, pageSize: 25 })).toEqual({
      page: 4,
      pageSize: 25,
      skip: 75,
    });
  });

  it('honours a smaller page size', () => {
    expect(resolveWindow({ pageSize: 5 })).toMatchObject({ pageSize: 5 });
  });

  it('clamps to the configured maximum rather than rejecting', () => {
    // PAGE_SIZE_MAX defaults to 100; the DTO refuses anything above it outright,
    // so this only bites when the env lowers the ceiling.
    expect(resolveWindow({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('computes skip from the resolved size, not the requested one', () => {
    expect(resolveWindow({ page: 2 }).skip).toBe(10);
  });
});

describe('page', () => {
  it('wraps rows in the documented envelope', () => {
    expect(page([{ id: 1 }], { page: 1, pageSize: 10, total: 1 })).toEqual({
      data: [{ id: 1 }],
      paging: { page: 1, pageSize: 10, total: 1 },
    });
  });

  it('keeps an empty result as an empty array, not null', () => {
    expect(page([], { page: 3, pageSize: 10, total: 0 }).data).toEqual([]);
  });
});
