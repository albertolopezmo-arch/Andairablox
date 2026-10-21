export class StatsRepository {
  constructor(config = {}, sessionProvider = () => null, client = null) { this.config = config; this.sessionProvider = sessionProvider; this.client = client; }
  async fetchStats() {
    const session = this.sessionProvider();
    if (!this.config.url || !this.config.publicKey || !session?.access_token || !session?.user?.id) return { points: 0, coins: 0, dailyCompletedDate: null, dailyLastScore: 0, streakDays: 0, rewardCycle: null, claimedMilestones: [] };
    const url = new URL('/rest/v1/quiz_lqsa_stats', this.config.url);
    url.searchParams.set('user_id', `eq.${session.user.id}`);
    url.searchParams.set('select', '*');
    const response = await fetch(url, { headers: { apikey: this.config.publicKey, Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      const error=await response.json().catch(()=>({}));
      if(response.status===401)throw new Error('Tu sesión ha caducado. Pulsa REINTENTAR para reconectar.');
      throw new Error(error.message||`No se pudo actualizar el saldo (${response.status}).`);
    }
    const [row] = await response.json();
    const claimsUrl=new URL('/rest/v1/quiz_lqsa_streak_rewards',this.config.url);
    claimsUrl.searchParams.set('user_id',`eq.${session.user.id}`);
    claimsUrl.searchParams.set('cycle_id',`eq.${row?.reward_cycle||'initial'}`);
    claimsUrl.searchParams.set('select','milestone');
    let claims=[],rewardsUnavailable=false;
    try {
      const claimsResponse=await fetch(claimsUrl,{headers:{apikey:this.config.publicKey,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(10000)});
      if(!claimsResponse.ok)throw new Error('streak_rewards_unavailable');
      claims=await claimsResponse.json();
    } catch { rewardsUnavailable=true; }
    return {
      points: Math.max(0, Number(row?.points) || 0),
      coins: Math.max(0, Number(row?.coins) || 0),
      dailyCompletedDate: row?.daily_completed_date || null,
      dailyLastScore: Math.max(0, Number(row?.daily_last_score) || 0),
      streakDays: Math.max(0,Number(row?.streak_days)||0),
      rewardCycle: row?.reward_cycle||'initial',
      claimedMilestones: claims.map(r=>Number(r.milestone)),
      ...(rewardsUnavailable?{rewardsUnavailable:true}:{}),
      ...(row?.daily_base_coins!==undefined?{dailyBaseCoins:Number(row.daily_base_coins)||0,dailyCoinsDoubled:Boolean(row.daily_coins_doubled)}:{})
    };
  }

  async aliasAvailable(alias) {
    if(!this.client)throw new Error('Supabase no está disponible.');
    return this.client.rpc('quiz_lqsa_alias_available',{p_alias:alias},this.sessionProvider());
  }

  async saveProfile(profile) {
    if (!this.client) throw new Error('Supabase no está disponible.');
    return this.client.rpc('quiz_lqsa_save_profile', { p_alias: profile.alias, p_avatar_id: profile.avatar }, this.sessionProvider());
  }

  async registerDailyVisit() {
    if (!this.client) throw new Error('Supabase no está disponible.');
    return this.client.rpc('quiz_lqsa_register_daily_visit', {}, this.sessionProvider());
  }

  async submitDaily(correctTimes) {
    if (!this.client) throw new Error('Supabase no está disponible.');
    const result = await this.client.rpc('quiz_lqsa_submit_daily', { p_correct_remaining_ms: correctTimes }, this.sessionProvider());
    return Array.isArray(result) ? result[0] : result;
  }

  async claimStreak(milestone,cycle) {
    if(!this.client)throw new Error('Supabase no está disponible.');
    return this.client.rpc('quiz_lqsa_claim_streak',{p_milestone:milestone,p_cycle:cycle},this.sessionProvider());
  }

  async fetchTopPlayers() {
    if (!this.client) throw new Error('Supabase no está disponible.');
    const result = await this.client.rpc('quiz_lqsa_top_players', {}, this.sessionProvider());
    return Array.isArray(result) ? result : [];
  }

  async fetchStoreOwned() {
    const session=this.sessionProvider();
    if(!this.config.url||!this.config.publicKey||!session?.access_token)throw new Error('Conéctate para consultar tus compras.');
    const url=new URL('/rest/v1/quiz_lqsa_store_purchases',this.config.url);
    url.searchParams.set('select','item_id');
    const response=await fetch(url,{headers:{apikey:this.config.publicKey,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||'No se pudo cargar tu colección. Ejecuta el SQL de la Tienda en Supabase.');}
    return (await response.json()).map(row=>row.item_id);
  }

  async buyStoreItem(itemId) {
    if(!this.client)throw new Error('Supabase no está disponible.');
    try{return await this.client.rpc('quiz_lqsa_buy_store_item',{p_item_id:itemId},this.sessionProvider());}
    catch(error){
      if(error.message?.includes('insufficient_coins'))throw new Error('No tienes monedas suficientes para este artículo.');
      if(error.message?.includes('store_item_invalid'))throw new Error('Este artículo ya no está disponible.');
      if(error.message?.includes('store_profile_missing'))throw new Error('No se encontró tu perfil. Vuelve a conectarte e inténtalo de nuevo.');
      if(error.message?.includes('quiz_lqsa_buy_store_item')||error.message?.includes('schema cache'))throw new Error('La Tienda todavía no está activada en Supabase. Ejecuta el SQL de actualización.');
      throw error;
    }
  }
}
