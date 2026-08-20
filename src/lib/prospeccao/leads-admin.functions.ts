import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const uploadLeadsBatch = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    filename: z.string(),
    leads: z.array(z.record(z.any())),
  }).parse(data))
  .handler(async ({ data, context }) => {
    // Note: requireSupabaseAuth should be used if we want to restrict this to authenticated users
    // For now, I'll assume the client handles auth and passes the session.
    
    const { filename, leads } = data;
    
    // 1. Create batch record
    const { data: batch, error: batchError } = await supabase
      .from("lead_batches")
      .insert({
        filename,
        total_leads: leads.length,
        status: "processing"
      })
      .select()
      .single();
      
    if (batchError) throw new Error(`Failed to create batch: ${batchError.message}`);
    
    // 2. Insert raw leads (in chunks if necessary, but 1000 at a time is usually safe)
    const chunkSize = 500;
    for (let i = 0; i < leads.length; i += chunkSize) {
      const chunk = leads.slice(i, i + chunkSize).map(lead => ({
        batch_id: batch.id,
        data: lead,
        status: "new"
      }));
      
      const { error: leadsError } = await supabase
        .from("leads_raw")
        .insert(chunk);
        
      if (leadsError) {
        await supabase.from("lead_batches").update({ status: "error", error_message: leadsError.message }).eq("id", batch.id);
        throw new Error(`Failed to insert leads: ${leadsError.message}`);
      }
    }
    
    // 3. Mark batch as completed
    await supabase.from("lead_batches").update({ status: "completed", processed_leads: leads.length }).eq("id", batch.id);
    
    return { batchId: batch.id, count: leads.length };
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
