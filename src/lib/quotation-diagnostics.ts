/**
 * Diagnostic log function for Request Card quotation fetcher
 * Intercepts the quotation API response and prints the raw object structure to the console,
 * verifying the fields 'id', 'quotation_id', 'booking_id', and the structure of 'charges' or 'quotation_charges' arrays.
 */
export function logQuotationResponseDiagnostics(
  responseObject: unknown,
  contextLabel: string = "Request Card Quotation Fetcher",
): void {
  const records: any[] = Array.isArray(responseObject)
    ? responseObject
    : responseObject &&
        typeof responseObject === "object" &&
        "quotations" in (responseObject as Record<string, unknown>) &&
        Array.isArray((responseObject as Record<string, unknown>).quotations)
      ? ((responseObject as Record<string, unknown>).quotations as any[])
      : responseObject
        ? [responseObject]
        : [];

  const verifiedRecords = records.map((item: any, idx: number) => {
    const id =
      item?.id ||
      item?.quotationId ||
      item?.offerData?.id ||
      item?.requestId ||
      `record-${idx}`;
    const quotation_id =
      item?.quotation_id ||
      item?.quotationId ||
      item?.offerData?.quotationId ||
      item?.offerData?.id ||
      item?.id;
    const booking_id =
      item?.booking_id ||
      item?.bookingId ||
      item?.offerData?.bookingId ||
      item?.bookingReference ||
      item?.movementNumber;
    const charges =
      item?.charges ||
      item?.quotation_charges ||
      item?.offerData?.itemizedCharges ||
      item?.itemizedCharges ||
      [];

    return {
      index: idx,
      id,
      has_id: Boolean(id),
      quotation_id,
      has_quotation_id: Boolean(quotation_id),
      booking_id,
      has_booking_id: Boolean(booking_id),
      charges_count: Array.isArray(charges) ? charges.length : 0,
      charges_structure: charges,
      has_charges_array: Array.isArray(charges),
      status: item?.status || item?.quotation_status,
      forwarderName: item?.forwarderName || item?.forwarder_name,
      ratePerContainer:
        item?.ratePerContainer ||
        item?.offerData?.ratePerContainer ||
        item?.ocean_freight,
      totalFreight:
        item?.totalFreight ||
        item?.offerData?.totalFreight ||
        item?.quoted_total,
      rawItem: item,
    };
  });

  console.log(
    `[DiagnosticLog][${contextLabel}] Intercepted raw quotation response object:`,
    {
      rawResponseObject: responseObject,
      recordCount: verifiedRecords.length,
      verificationSummary: verifiedRecords.map((r) => ({
        id: r.id,
        quotation_id: r.quotation_id,
        booking_id: r.booking_id,
        has_id: r.has_id,
        has_quotation_id: r.has_quotation_id,
        has_booking_id: r.has_booking_id,
        charges_count: r.charges_count,
        has_charges_array: r.has_charges_array,
      })),
      detailedRecords: verifiedRecords,
    },
  );
}

export interface PropertyAlignmentReport {
  field: string;
  apiValue: unknown;
  apiFieldUsed: string | null;
  formValue: unknown;
  formPropertyUsed: string | null;
  isAligned: boolean;
  notes: string;
}

/**
 * Diagnostic check that compares the fetched API response fields against
 * the currently rendered form state properties to ensure property name alignment
 * (e.g., 'quotation_id' vs 'id', 'ocean_freight' vs 'ratePerContainer', 'booking_id' vs 'bookingId').
 */
export function runPropertyAlignmentDiagnostic(
  apiData: Record<string, unknown> | null | undefined,
  formState: Record<string, unknown> | null | undefined,
  contextName: string = "Forwarder Quotation Popup",
): PropertyAlignmentReport[] {
  if (!apiData || !formState) {
    console.warn(
      `[PropertyAlignmentDiagnostic][${contextName}] Diagnostic skipped: missing API data or form state.`,
    );
    return [];
  }

  const comparisons: PropertyAlignmentReport[] = [
    {
      field: "Quotation Identifier",
      apiValue:
        apiData.quotation_id ??
        apiData.quotationId ??
        apiData.id ??
        (apiData.offerData as any)?.quotationId ??
        (apiData.offerData as any)?.id,
      apiFieldUsed: apiData.quotation_id
        ? "quotation_id"
        : apiData.id
          ? "id"
          : apiData.quotationId
            ? "quotationId"
            : "none",
      formValue: formState.id ?? formState.quotationId ?? formState.requestId,
      formPropertyUsed: formState.id
        ? "id"
        : formState.quotationId
          ? "quotationId"
          : formState.requestId
            ? "requestId"
            : "none",
      isAligned: Boolean(
        (apiData.quotation_id ?? apiData.id ?? apiData.quotationId) &&
          (formState.id ?? formState.quotationId ?? formState.requestId),
      ),
      notes: "Checks alignment between backend 'quotation_id' / 'id' and component form state 'id' / 'quotationId'.",
    },
    {
      field: "Booking Identifier",
      apiValue:
        apiData.booking_id ??
        apiData.bookingId ??
        (apiData.offerData as any)?.bookingId ??
        apiData.movementNumber,
      apiFieldUsed: apiData.booking_id
        ? "booking_id"
        : apiData.bookingId
          ? "bookingId"
          : apiData.movementNumber
            ? "movementNumber"
            : "none",
      formValue: formState.bookingId ?? formState.booking_id ?? formState.movementNumber,
      formPropertyUsed: formState.bookingId
        ? "bookingId"
        : formState.booking_id
          ? "booking_id"
          : formState.movementNumber
            ? "movementNumber"
            : "none",
      isAligned: Boolean(
        (apiData.booking_id ?? apiData.bookingId) &&
          (formState.bookingId ?? formState.booking_id),
      ),
      notes: "Checks alignment between backend 'booking_id' and form state 'bookingId'.",
    },
    {
      field: "Ocean Freight / Container Rate",
      apiValue:
        apiData.ocean_freight ??
        apiData.rate ??
        apiData.ratePerContainer ??
        (apiData.offerData as any)?.ratePerContainer ??
        (apiData.offerData as any)?.oceanFreight,
      apiFieldUsed: apiData.ocean_freight
        ? "ocean_freight"
        : apiData.rate
          ? "rate"
          : apiData.ratePerContainer
            ? "ratePerContainer"
            : "none",
      formValue: formState.ratePerContainer ?? formState.oceanFreight ?? formState.rate,
      formPropertyUsed: formState.ratePerContainer
        ? "ratePerContainer"
        : formState.oceanFreight
          ? "oceanFreight"
          : formState.rate
            ? "rate"
            : "none",
      isAligned: Boolean(
        (apiData.ocean_freight ?? apiData.rate ?? apiData.ratePerContainer) !== undefined &&
          (formState.ratePerContainer ?? formState.oceanFreight ?? formState.rate) !== undefined,
      ),
      notes: "Checks alignment between backend 'ocean_freight' / 'rate' and form state 'ratePerContainer' / 'oceanFreight'.",
    },
    {
      field: "Quoted Total Freight",
      apiValue:
        apiData.quoted_total ??
        apiData.total_cost ??
        apiData.totalFreight ??
        (apiData.offerData as any)?.totalFreight,
      apiFieldUsed: apiData.quoted_total
        ? "quoted_total"
        : apiData.total_cost
          ? "total_cost"
          : apiData.totalFreight
            ? "totalFreight"
            : "none",
      formValue: formState.quotedTotal ?? formState.totalFreight ?? formState.total_cost,
      formPropertyUsed: formState.quotedTotal
        ? "quotedTotal"
        : formState.totalFreight
          ? "totalFreight"
          : formState.total_cost
            ? "total_cost"
            : "none",
      isAligned: Boolean(
        (apiData.quoted_total ?? apiData.total_cost ?? apiData.totalFreight) !== undefined &&
          (formState.quotedTotal ?? formState.totalFreight) !== undefined,
      ),
      notes: "Checks alignment between backend 'quoted_total' / 'total_cost' and form state 'quotedTotal' / 'totalFreight'.",
    },
    {
      field: "Currency",
      apiValue: apiData.currency ?? (apiData.offerData as any)?.currency,
      apiFieldUsed: "currency",
      formValue: formState.currency,
      formPropertyUsed: "currency",
      isAligned: Boolean(
        apiData.currency &&
          formState.currency &&
          String(apiData.currency).toUpperCase() === String(formState.currency).toUpperCase(),
      ),
      notes: "Checks currency code alignment.",
    },
    {
      field: "Itemized Charges Array",
      apiValue:
        apiData.charges ??
        apiData.quotation_charges ??
        (apiData.offerData as any)?.itemizedCharges ??
        apiData.itemizedCharges,
      apiFieldUsed: apiData.charges
        ? "charges"
        : apiData.quotation_charges
          ? "quotation_charges"
          : "itemizedCharges",
      formValue: formState.itemizedCharges ?? formState.charges ?? formState.quotation_charges,
      formPropertyUsed: formState.itemizedCharges
        ? "itemizedCharges"
        : formState.charges
          ? "charges"
          : formState.quotation_charges
            ? "quotation_charges"
            : "none",
      isAligned: Array.isArray(
        apiData.charges || apiData.quotation_charges || (apiData.offerData as any)?.itemizedCharges,
      ),
      notes: "Checks alignment between backend 'charges' / 'quotation_charges' array and form state 'itemizedCharges' / 'charges'.",
    },
    {
      field: "Sailing Date / ETD",
      apiValue:
        apiData.sailing_date ??
        apiData.etd ??
        (apiData.offerData as any)?.etd ??
        (apiData.offerData as any)?.sailingDate,
      apiFieldUsed: apiData.sailing_date ? "sailing_date" : apiData.etd ? "etd" : "none",
      formValue: formState.etd ?? formState.sailingDate,
      formPropertyUsed: formState.etd ? "etd" : formState.sailingDate ? "sailingDate" : "none",
      isAligned: Boolean(
        (apiData.sailing_date || apiData.etd) && (formState.etd || formState.sailingDate),
      ),
      notes: "Checks alignment between backend 'sailing_date' / 'etd' and form state 'etd'.",
    },
    {
      field: "Arrival Date / ETA",
      apiValue: apiData.arrival_date ?? apiData.eta ?? (apiData.offerData as any)?.eta,
      apiFieldUsed: apiData.arrival_date ? "arrival_date" : apiData.eta ? "eta" : "none",
      formValue: formState.eta,
      formPropertyUsed: "eta",
      isAligned: Boolean((apiData.arrival_date || apiData.eta) && formState.eta),
      notes: "Checks alignment between backend 'arrival_date' / 'eta' and form state 'eta'.",
    },
    {
      field: "Vessel Name",
      apiValue:
        apiData.vessel_name ?? apiData.vessel ?? (apiData.offerData as any)?.vesselName,
      apiFieldUsed: apiData.vessel_name ? "vessel_name" : apiData.vessel ? "vessel" : "none",
      formValue: formState.vesselName ?? formState.vessel,
      formPropertyUsed: formState.vesselName
        ? "vesselName"
        : formState.vessel
          ? "vessel"
          : "none",
      isAligned: Boolean(
        (apiData.vessel_name || apiData.vessel) && (formState.vesselName || formState.vessel),
      ),
      notes: "Checks alignment between backend 'vessel_name' and form state 'vesselName'.",
    },
    {
      field: "Quotation Status",
      apiValue: apiData.quotation_status ?? apiData.status,
      apiFieldUsed: apiData.quotation_status
        ? "quotation_status"
        : apiData.status
          ? "status"
          : "none",
      formValue: formState.status,
      formPropertyUsed: "status",
      isAligned: Boolean((apiData.quotation_status || apiData.status) && formState.status),
      notes: "Checks alignment between backend 'quotation_status' and form state 'status'.",
    },
  ];

  console.log(`[PropertyAlignmentDiagnostic][${contextName}] Comparison report:`, {
    rawApiDataSample: apiData,
    renderedFormStateSample: formState,
    alignmentsCount: comparisons.filter((c) => c.isAligned).length,
    totalFieldsChecked: comparisons.length,
    fieldComparisons: comparisons,
  });

  return comparisons;
}
