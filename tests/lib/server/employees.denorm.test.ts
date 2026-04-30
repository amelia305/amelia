import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { listEmployeesForCompany, getEmployee } from '$lib/server/employees';

// ─── Mock Firebase ────────────────────────────────────────────────────────────

const mockDb = {
  collection: vi.fn(),
} as unknown as Firestore;

describe('employees denormalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEmployeesForCompany with latestIsme and latestCompletedAt', () => {
    it('parses employee doc with latestIsme and latestCompletedAt and returns both fields', async () => {
      const mockTimestamp = Timestamp.now();
      const mockDocs = [
        {
          id: 'emp-1',
          data: () => ({
            name: 'John Doe',
            email: 'john@company.com',
            role: 'executive',
            nationalId: '123456',
            birthDate: '1990-01-01',
            gender: 'M',
            tenureMonths: 12,
            latestAssessmentId: 'asmt-1',
            latestIsme: 72,
            latestCompletedAt: mockTimestamp,
            createdAt: Timestamp.now(),
            createdBy: 'admin',
          }),
        },
      ];

      const mockQuery = {
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
      };

      const mockCollectionRef = {
        collection: vi.fn().mockReturnValue(mockQuery),
      };

      const mockCompaniesCollection = {
        doc: vi.fn().mockReturnValue(mockCollectionRef),
      };

      (mockDb.collection as ReturnType<typeof vi.fn>).mockReturnValue(mockCompaniesCollection);

      const result = await listEmployeesForCompany(mockDb, 'cmp-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'emp-1',
        name: 'John Doe',
        email: 'john@company.com',
        role: 'executive',
        activeToken: undefined,
        archived: false,
        latestAssessmentId: 'asmt-1',
        latestIsme: 72,
        latestCompletedAt: mockTimestamp,
      });
    });

    it('returns undefined for latestIsme and latestCompletedAt when legacy employee doc has no denorm fields', async () => {
      const mockDocs = [
        {
          id: 'emp-legacy',
          data: () => ({
            name: 'Jane Smith',
            email: 'jane@company.com',
            role: 'middleManagement',
            nationalId: '789012',
            birthDate: '1985-06-15',
            gender: 'F',
            tenureMonths: 24,
            createdAt: Timestamp.now(),
            createdBy: 'admin',
            // No latestIsme, latestCompletedAt, or latestAssessmentId
          }),
        },
      ];

      const mockQuery = {
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
      };

      const mockCollectionRef = {
        collection: vi.fn().mockReturnValue(mockQuery),
      };

      const mockCompaniesCollection = {
        doc: vi.fn().mockReturnValue(mockCollectionRef),
      };

      (mockDb.collection as ReturnType<typeof vi.fn>).mockReturnValue(mockCompaniesCollection);

      const result = await listEmployeesForCompany(mockDb, 'cmp-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'emp-legacy',
        name: 'Jane Smith',
        email: 'jane@company.com',
        role: 'middleManagement',
        activeToken: undefined,
        archived: false,
        latestAssessmentId: undefined,
        latestIsme: null,
        latestCompletedAt: null,
      });
    });

    it('handles mixed employee docs with and without denorm fields', async () => {
      const mockTimestamp = Timestamp.now();
      const mockDocs = [
        {
          id: 'emp-with-denorm',
          data: () => ({
            name: 'With Denorm',
            email: 'with@company.com',
            role: 'executive',
            nationalId: '111111',
            birthDate: '1990-01-01',
            gender: 'M',
            tenureMonths: 12,
            latestAssessmentId: 'asmt-1',
            latestIsme: 75,
            latestCompletedAt: mockTimestamp,
            createdAt: Timestamp.now(),
            createdBy: 'admin',
          }),
        },
        {
          id: 'emp-legacy',
          data: () => ({
            name: 'Legacy Employee',
            email: 'legacy@company.com',
            role: 'operational',
            nationalId: '222222',
            birthDate: '1992-03-15',
            gender: 'F',
            tenureMonths: 6,
            createdAt: Timestamp.now(),
            createdBy: 'admin',
          }),
        },
      ];

      const mockQuery = {
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
      };

      const mockCollectionRef = {
        collection: vi.fn().mockReturnValue(mockQuery),
      };

      const mockCompaniesCollection = {
        doc: vi.fn().mockReturnValue(mockCollectionRef),
      };

      (mockDb.collection as ReturnType<typeof vi.fn>).mockReturnValue(mockCompaniesCollection);

      const result = await listEmployeesForCompany(mockDb, 'cmp-1');

      expect(result).toHaveLength(2);
      expect(result[0].latestIsme).toBe(75);
      expect(result[0].latestCompletedAt).toBe(mockTimestamp);
      expect(result[1].latestIsme).toBe(null);
      expect(result[1].latestCompletedAt).toBe(null);
    });
  });

  describe('getEmployee with latestIsme and latestCompletedAt', () => {
    it('returns employee detail with latestIsme and latestCompletedAt when present', async () => {
      const mockTimestamp = Timestamp.now();
      const mockDoc = {
        exists: true,
        id: 'emp-1',
        data: () => ({
          name: 'John Doe',
          email: 'john@company.com',
          role: 'executive',
          nationalId: '123456',
          birthDate: '1990-01-01',
          gender: 'M',
          tenureMonths: 12,
          latestAssessmentId: 'asmt-1',
          latestIsme: 68,
          latestCompletedAt: mockTimestamp,
          createdAt: Timestamp.now(),
          createdBy: 'admin',
        }),
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue(mockDoc),
      };

      const mockCollectionRef = {
        doc: vi.fn().mockReturnValue(mockDocRef),
      };

      const mockCompanyRef = {
        collection: vi.fn().mockReturnValue(mockCollectionRef),
      };

      const mockCompaniesCollection = {
        doc: vi.fn().mockReturnValue(mockCompanyRef),
      };

      (mockDb.collection as ReturnType<typeof vi.fn>).mockReturnValue(mockCompaniesCollection);

      const result = await getEmployee(mockDb, 'emp-1', 'cmp-1');

      expect(result).toEqual({
        id: 'emp-1',
        name: 'John Doe',
        email: 'john@company.com',
        role: 'executive',
        nationalId: '123456',
        birthDate: '1990-01-01',
        gender: 'M',
        tenureMonths: 12,
        activeToken: undefined,
        latestAssessmentId: 'asmt-1',
        latestIsme: 68,
        latestCompletedAt: mockTimestamp,
        archived: false,
      });
    });

    it('returns null for denorm fields for legacy employee without them', async () => {
      const mockDoc = {
        exists: true,
        id: 'emp-legacy',
        data: () => ({
          name: 'Jane Smith',
          email: 'jane@company.com',
          role: 'middleManagement',
          nationalId: '789012',
          birthDate: '1985-06-15',
          gender: 'F',
          tenureMonths: 24,
          createdAt: Timestamp.now(),
          createdBy: 'admin',
        }),
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue(mockDoc),
      };

      const mockCollectionRef = {
        doc: vi.fn().mockReturnValue(mockDocRef),
      };

      const mockCompanyRef = {
        collection: vi.fn().mockReturnValue(mockCollectionRef),
      };

      const mockCompaniesCollection = {
        doc: vi.fn().mockReturnValue(mockCompanyRef),
      };

      (mockDb.collection as ReturnType<typeof vi.fn>).mockReturnValue(mockCompaniesCollection);

      const result = await getEmployee(mockDb, 'emp-legacy', 'cmp-1');

      expect(result).toEqual({
        id: 'emp-legacy',
        name: 'Jane Smith',
        email: 'jane@company.com',
        role: 'middleManagement',
        nationalId: '789012',
        birthDate: '1985-06-15',
        gender: 'F',
        tenureMonths: 24,
        activeToken: undefined,
        latestAssessmentId: undefined,
        latestIsme: null,
        latestCompletedAt: null,
        archived: false,
      });
    });
  });
});
