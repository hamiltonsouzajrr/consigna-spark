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
