import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const createLeadBatch = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    filename: z.string(),
    totalLeads: z.number(),
    columnMapping: z.array(z.string()).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { filename, totalLeads, columnMapping } = data;
    
    const { data: batch, error } = await supabase
      .from("lead_batches")
      .insert({
        filename,
        total_leads: totalLeads,
        status: "pending",
        processed_leads: 0,
        column_mapping: columnMapping
      })
      .select()
      .single();

      
    if (error) throw new Error(`Failed to create batch: ${error.message}`);
    return batch;
  });

export const processLeadChunk = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    batchId: z.string(),
    leads: z.array(z.record(z.any())),
    isLastChunk: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { batchId, leads, isLastChunk } = data;
    
    // Insert chunk
    const leadsToInsert = leads.map(lead => ({
      batch_id: batchId,
      data: lead,
      status: "new"
    }));
    
    const { error: leadsError } = await supabase
      .from("leads_raw")
      .insert(leadsToInsert);
      
    if (leadsError) {
      await supabase.from("lead_batches").update({ status: "error", error_message: leadsError.message }).eq("id", batchId);
      throw new Error(`Failed to insert leads: ${leadsError.message}`);
    }
    
    // Update progress
    const { data: batch } = await supabase
      .from("lead_batches")
      .select("processed_leads, total_leads")
      .eq("id", batchId)
      .single();
      
    const newProcessedCount = (batch?.processed_leads || 0) + leads.length;
    
    const updateData: any = { 
      processed_leads: newProcessedCount,
      status: isLastChunk ? "completed" : "processing"
    };
    
    await supabase.from("lead_batches").update(updateData).eq("id", batchId);
    
    return { success: true, processed: newProcessedCount };
  });


export const getLeadBatches = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("lead_batches")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error) throw new Error(error.message);
    return data;
  });

export const getLeadsByBatch = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ batchId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: leads, error } = await supabase
      .from("leads_raw")
      .select("*")
      .eq("batch_id", data.batchId);
      
    if (error) throw new Error(error.message);
    return leads;
  });

export const assignBatchToConsultant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    batchId: z.string(),
    consultantId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase: userSupabase, userId } = context;
    const { batchId, consultantId } = data;

    // 1. Get the batch and its mapping
    const { data: batch, error: batchError } = await supabase
      .from("lead_batches")
      .select("*")
      .eq("id", batchId)
      .single();
    if (batchError) throw new Error(batchError.message);

    // 2. Get the leads from leads_raw
    const { data: rawLeads, error: rawError } = await supabase
      .from("leads_raw")
      .select("*")
      .eq("batch_id", batchId);
    if (rawError) throw new Error(rawError.message);

    // 3. Prepare prospect_leads rows
    const mapping = (batch.column_mapping || []) as string[];
    
    // Try to find common field names for basic CRM fields
    const findField = (row: any, keys: string[]) => {
      const match = Object.keys(row).find(k => 
        keys.some(key => k.toLowerCase().includes(key.toLowerCase()))
      );
      return match ? row[match] : null;
    };

    const prospectLeads = rawLeads.map(raw => {
      const row = raw.data as any;
      return {
        nome: findField(row, ["nome", "cliente", "name"]) || "Lead Importado",
        telefone: findField(row, ["telefone", "celular", "phone", "tel"]),
        cidade: findField(row, ["cidade", "city"]),
        cpf: findField(row, ["cpf", "documento"]),
        consultant_id: consultantId,
        created_by: userId,
        status: "novo",
        origem: "planilha_importada",
        import_batch: batch.filename,
        batch_id: batchId,
        raw_data: row
      };
    });

    // 4. Insert in chunks
    const chunkSize = 500;
    for (let i = 0; i < prospectLeads.length; i += chunkSize) {
      const chunk = prospectLeads.slice(i, i + chunkSize);
      const { error: insertError } = await supabase.from("prospect_leads").insert(chunk);
      if (insertError) throw new Error(insertError.message);
    }

    // 5. Mark batch as assigned
    await supabase.from("lead_batches").update({ status: "completed" }).eq("id", batchId);

    return { success: true, count: prospectLeads.length };
  });
