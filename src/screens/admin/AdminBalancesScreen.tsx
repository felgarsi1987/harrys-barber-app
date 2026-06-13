import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart } from "react-native-chart-kit";
import {
  collection, getDocs, query, where, Timestamp,
} from "firebase/firestore";
import { db }             from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useFocusEffect } from "@react-navigation/native";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;

interface ServicioRealizado {
  precio:           number;
  servicio:         string;
  fecha:            Timestamp;
  estado?:          string;
  modalidadPago?:   string;
  peluqueroUid?:    string;
  peluqueroNombre?: string;
}
interface PedidoAprobado {
  total:     number;
  fecha:     Timestamp;
  createdAt: Timestamp;
  items:     { nombre: string; cantidad: number; precio: number; categoria?: string }[];
}
interface ClienteDeuda {
  saldo: number;
}

const PERIODOS = ["7 días","30 días","Este año"] as const;
type Periodo = typeof PERIODOS[number];
type Vista   = "todo" | "peluqueria" | "tienda";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function AdminBalancesScreen() {
  const c = useThemeColors();
  const [servicios,     setServicios]     = useState<ServicioRealizado[]>([]);
  const [pedidos,       setPedidos]       = useState<PedidoAprobado[]>([]);
  const [creditoTotal,  setCreditoTotal]  = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [periodo,       setPeriodo]       = useState<Periodo>("Este año");
  const [vista,         setVista]         = useState<Vista>("todo");
  const [peluqueroFil,  setPeluqueroFil]  = useState<string>("todos");

  const loadData = async () => {
    try {
      const [servSnap, pedSnap, credSnap] = await Promise.all([
        getDocs(collection(db, "servicios_realizados")),
        getDocs(collection(db, "pedidos")),
        getDocs(query(collection(db,"users"), where("role","==","cliente"), where("saldo",">",0))),
      ]);
      const servData = servSnap.docs
        .map(d => d.data() as ServicioRealizado)
        .sort((a,b) => {
          try { return a.fecha.toMillis() - b.fecha.toMillis(); } catch { return 0; }
        });
      setServicios(servData);
      setPedidos(pedSnap.docs.map(d=>d.data() as PedidoAprobado).sort((a,b)=>(a.createdAt??a.fecha).toMillis()-(b.createdAt??b.fecha).toMillis()));
      // Load credits separately - has compound where that may need index
      try {
        const credSnap = await getDocs(
          query(collection(db,"users"), where("role","==","cliente"))
        );
        const total = credSnap.docs.reduce((acc,d)=>acc+(d.data().saldo??0),0);
        setCreditoTotal(total);
      } catch {}
    } catch(e) { }
    finally { setLoading(false); }
  };

  // Load on mount
  useEffect(() => { loadData(); }, []);
  // Reload when screen comes into focus
  useFocusEffect(useCallback(() => { loadData(); }, []));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const ahora = new Date();
  const enPeriodo = (ts: any) => {
    try {
      const f = ts?.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(f.getTime())) return true; // include if date is invalid
      if (periodo === "7 días")  { const d=new Date(ahora); d.setDate(ahora.getDate()-7);  return f>=d; }
      if (periodo === "30 días") { const d=new Date(ahora); d.setDate(ahora.getDate()-30); return f>=d; }
      return f.getFullYear()===ahora.getFullYear();
    } catch { return true; } // include if error parsing date
  };

  const servFiltBase = servicios.filter(s=>enPeriodo(s.fecha));
  const servFilt = vista==="peluqueria" && peluqueroFil!=="todos"
    ? servFiltBase.filter(s=>s.peluqueroNombre===peluqueroFil)
    : servFiltBase;
  const pedFilt  = pedidos.filter(p=>enPeriodo(p.createdAt??p.fecha));

  // KPIs
  const ingServicios = servFilt.reduce((a,s)=>a+(s.precio??0),0);
  const ingTienda    = pedFilt.reduce((a,p)=>a+(p.total??0),0);
  const ingTotal     = ingServicios + ingTienda;
  const ticketProm   = servFilt.length>0 ? Math.round(ingServicios/servFilt.length) : 0;

  // Contado vs crédito en servicios
  const ingContado = servFilt.filter(s=>s.modalidadPago==="contado").reduce((a,s)=>a+(s.precio??0),0);
  const ingCredito = servFilt.filter(s=>s.modalidadPago==="credito").reduce((a,s)=>a+(s.precio??0),0);

  // Gráfica
  const buildBarData = () => {
    const source = vista==="tienda" ? [] : servFilt;
    if (periodo==="Este año") {
      const m=Array(12).fill(0);
      source.forEach(s=>{m[s.fecha.toDate().getMonth()]+=(s.precio??0);});
      return { labels:MESES, datasets:[{data:m}] };
    }
    if (periodo==="30 días") {
      const sem=[0,0,0,0];
      source.forEach(s=>{
        const d=Math.floor((ahora.getTime()-s.fecha.toDate().getTime())/86400000);
        sem[Math.min(3,Math.floor(d/7))]+=(s.precio??0);
      });
      return { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], datasets:[{data:sem}] };
    }
    const dias=Array(7).fill(0);
    const labs=[];
    for(let i=6;i>=0;i--){const d=new Date(ahora);d.setDate(ahora.getDate()-i);labs.push(["D","L","M","X","J","V","S"][d.getDay()]);}
    source.forEach(s=>{const d=Math.floor((ahora.getTime()-s.fecha.toDate().getTime())/86400000);if(d<7)dias[6-d]+=(s.precio??0);});
    return { labels:labs, datasets:[{data:dias}] };
  };

  // Top servicios
  const topServ: Record<string,number>={};
  servFilt.forEach(s=>{topServ[s.servicio]=(topServ[s.servicio]??0)+(s.precio??0);});
  const topServSorted = Object.entries(topServ).sort(([,a],[,b])=>b-a).slice(0,4);

  // Top productos
  const topProd: Record<string,number>={};
  pedFilt.forEach(p=>p.items?.forEach(i=>{topProd[i.nombre]=(topProd[i.nombre]??0)+i.precio*i.cantidad;}));
  const topProdSorted = Object.entries(topProd).sort(([,a],[,b])=>b-a).slice(0,4);

  // Por empleado
  const porEmp: Record<string,{nombre:string;total:number;citas:number}>={};
  servFilt.forEach(s=>{
    const uid=s.peluqueroUid??"sin_asignar";
    if(!porEmp[uid]) porEmp[uid]={nombre:s.peluqueroNombre??"Sin asignar",total:0,citas:0};
    porEmp[uid].total+=(s.precio??0);
    porEmp[uid].citas+=1;
  });
  const empSorted = Object.values(porEmp).sort((a,b)=>b.total-a.total);

  const barData = buildBarData();
  const chartConfig = {
    backgroundGradientFrom: c.surface, backgroundGradientTo: c.surface,
    color:(o=1)=>`rgba(242,185,12,${o})`, labelColor:()=>c.sub,
    strokeWidth:2, barPercentage:0.6, decimalPlaces:0,
    propsForLabels:{fontFamily:"SpaceGrotesk_500Medium",fontSize:10},
  };

  const showPeluqueria = vista==="todo" || vista==="peluqueria";
  const showTienda     = vista==="todo" || vista==="tienda";

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Balances" />
      {loading ? <ActivityIndicator color={c.amber} style={{marginTop:40}}/> : (
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber}/>}
        >
          {/* Periodo */}
          <View style={[styles.segRow,{backgroundColor:c.surface,borderColor:c.border}]}>
            {PERIODOS.map(p=>(
              <TouchableOpacity key={p} onPress={()=>setPeriodo(p)}
                style={[styles.segBtn, periodo===p&&{backgroundColor:c.amber}]}>
                <Text style={[styles.segTxt,{color:periodo===p?"#000":c.sub}]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Vista tienda/peluquería */}
          <View style={[styles.segRow,{backgroundColor:c.surface,borderColor:c.border}]}>
            {([["todo","Todo"],["peluqueria","Peluquería"],["tienda","Tienda"]] as const).map(([k,l])=>(
              <TouchableOpacity key={k} onPress={()=>setVista(k)}
                style={[styles.segBtn, vista===k&&{backgroundColor:c.blue}]}>
                <Text style={[styles.segTxt,{color:vista===k?"#fff":c.sub}]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtro peluquero - solo cuando vista es peluqueria */}
          {vista === "peluqueria" && empSorted.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{gap:8}}>
              <TouchableOpacity
                onPress={() => setPeluqueroFil("todos")}
                style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,
                  borderColor:peluqueroFil==="todos"?c.blue:c.border,
                  backgroundColor:peluqueroFil==="todos"?c.blue+"22":"transparent"}}>
                <Text style={{fontSize:11,fontFamily:"SpaceGrotesk_600SemiBold",
                  color:peluqueroFil==="todos"?c.blue:c.sub}}>Todos</Text>
              </TouchableOpacity>
              {empSorted.map((e,i)=>(
                <TouchableOpacity key={i}
                  onPress={() => setPeluqueroFil(e.nombre)}
                  style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,
                    borderColor:peluqueroFil===e.nombre?c.blue:c.border,
                    backgroundColor:peluqueroFil===e.nombre?c.blue+"22":"transparent"}}>
                  <Text style={{fontSize:11,fontFamily:"SpaceGrotesk_600SemiBold",
                    color:peluqueroFil===e.nombre?c.blue:c.sub}}>{e.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* KPIs */}
          <Text style={[styles.sec,{color:c.sub}]}>RESUMEN</Text>
          <View style={styles.kpiRow}>
            <ThemedCard style={styles.kpi}>
              <MaterialIcons name="trending-up" size={16} color={c.sub}/>
              <Text style={[styles.kpiL,{color:c.sub}]}>Total</Text>
              <NumberText size={18} positive>${(showPeluqueria&&showTienda?ingTotal:showPeluqueria?ingServicios:ingTienda).toLocaleString("es-CO")}</NumberText>
            </ThemedCard>
            {showPeluqueria&&(
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="content-cut" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Servicios</Text>
                <NumberText size={18} positive>${ingServicios.toLocaleString("es-CO")}</NumberText>
              </ThemedCard>
            )}
            {showTienda&&(
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="store" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Tienda</Text>
                <NumberText size={18} positive>${ingTienda.toLocaleString("es-CO")}</NumberText>
              </ThemedCard>
            )}
          </View>

          {showPeluqueria&&(
            <View style={styles.kpiRow}>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="event" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Citas</Text>
                <NumberText size={18}>{servFilt.length.toString()}</NumberText>
              </ThemedCard>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="receipt" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Ticket prom.</Text>
                <NumberText size={18}>${ticketProm.toLocaleString("es-CO")}</NumberText>
              </ThemedCard>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="payments" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Crédito</Text>
                <NumberText size={18} negative>${ingCredito.toLocaleString("es-CO")}</NumberText>
              </ThemedCard>
            </View>
          )}

          {/* Créditos pendientes */}
          {creditoTotal>0&&(
            <ThemedCard style={[styles.creditCard,{borderColor:c.negative+"44",backgroundColor:c.negative+"0A"}]}>
              <MaterialIcons name="credit-card" size={18} color={c.negative}/>
              <View style={{flex:1}}>
                <Text style={[styles.kpiL,{color:c.sub}]}>CRÉDITOS PENDIENTES CLIENTES</Text>
                <NumberText size={20} negative>${creditoTotal.toLocaleString("es-CO")}</NumberText>
              </View>
            </ThemedCard>
          )}

          {ingTotal===0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="bar-chart" size={52} color={c.sub}/>
              <Text style={[styles.emptyT,{color:c.text}]}>Sin datos aún</Text>
              <Text style={[styles.emptyD,{color:c.sub}]}>Los ingresos aparecen cuando se completen servicios o se aprueben pedidos</Text>
            </View>
          ) : (<>

            {/* Gráfica servicios */}
            {showPeluqueria&&servFilt.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>INGRESOS SERVICIOS</Text>
              <ThemedCard style={{padding:8}}>
                <BarChart data={barData} width={CHART_W} height={180} chartConfig={chartConfig}
                  style={{borderRadius:12}} showValuesOnTopOfBars fromZero yAxisLabel="$" yAxisSuffix=""/>
              </ThemedCard>
              <Text style={[styles.sec,{color:c.sub}]}>TOP SERVICIOS</Text>
              {topServSorted.map(([n,t],i)=>{
                const pct=ingServicios>0?(t/ingServicios)*100:0;
                return(
                  <ThemedCard key={i} style={styles.topCard}>
                    <View style={styles.topRow}>
                      <Text style={[styles.topN,{color:c.text}]}>{n}</Text>
                      <Text style={[styles.topT,{color:c.amber}]}>${t.toLocaleString("es-CO")}</Text>
                    </View>
                    <View style={[styles.barBg,{backgroundColor:c.border}]}>
                      <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.amber}]}/>
                    </View>
                    <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                  </ThemedCard>
                );
              })}
            </>)}

            {/* Tienda */}
            {showTienda&&pedFilt.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>VENTAS TIENDA</Text>
              <View style={styles.kpiRow}>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="shopping-bag" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Total</Text>
                  <NumberText size={18} positive>${ingTienda.toLocaleString("es-CO")}</NumberText>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="inventory" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Pedidos</Text>
                  <NumberText size={18}>{pedFilt.length.toString()}</NumberText>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="receipt" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Prom.</Text>
                  <NumberText size={18}>${Math.round(ingTienda/pedFilt.length).toLocaleString("es-CO")}</NumberText>
                </ThemedCard>
              </View>
              {topProdSorted.length>0&&(<>
                <Text style={[styles.sec,{color:c.sub}]}>TOP PRODUCTOS</Text>
                {topProdSorted.map(([n,t],i)=>{
                  const pct=ingTienda>0?(t/ingTienda)*100:0;
                  return(
                    <ThemedCard key={i} style={styles.topCard}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topN,{color:c.text}]}>{n}</Text>
                        <Text style={[styles.topT,{color:c.positive}]}>${t.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg,{backgroundColor:c.border}]}>
                        <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.positive}]}/>
                      </View>
                      <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                    </ThemedCard>
                  );
                })}
              </>)}
            </>)}

            {/* Por empleado */}
            {showPeluqueria&&empSorted.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>POR EMPLEADO</Text>
              {empSorted.map((e,i)=>{
                const pct=ingServicios>0?(e.total/ingServicios)*100:0;
                return(
                  <ThemedCard key={i} style={styles.empCard}>
                    <View style={[styles.empAv,{backgroundColor:c.blue+"22"}]}>
                      <Text style={[styles.empAvT,{color:c.blue}]}>
                        {e.nombre.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{flex:1,gap:6}}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topN,{color:c.text}]}>{e.nombre}</Text>
                        <Text style={[styles.topT,{color:c.blue}]}>${e.total.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg,{backgroundColor:c.border}]}>
                        <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.blue}]}/>
                      </View>
                      <View style={{flexDirection:"row",justifyContent:"space-between"}}>
                        <Text style={[styles.topP,{color:c.sub}]}>{e.citas} cita{e.citas!==1?"s":""}</Text>
                        <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </ThemedCard>
                );
              })}
            </>)}

          </>)}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:    { padding:20, gap:16 },
  segRow:    { flexDirection:"row", borderRadius:12, borderWidth:1, overflow:"hidden" },
  segBtn:    { flex:1, paddingVertical:10, alignItems:"center", borderRadius:10 },
  segTxt:    { fontSize:12, fontFamily:"SpaceGrotesk_600SemiBold" },
  sec:       { fontSize:10, fontFamily:"SpaceGrotesk_600SemiBold", letterSpacing:2, marginTop:4 },
  kpiRow:    { flexDirection:"row", gap:10 },
  kpi:       { flex:1, gap:6, alignItems:"center" },
  kpiL:      { fontSize:10, fontFamily:"SpaceGrotesk_400Regular", textAlign:"center" },
  creditCard:{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:12, borderWidth:1, borderRadius:12 },
  topCard:   { gap:8 },
  topRow:    { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  topN:      { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold", flex:1, marginRight:8 },
  topT:      { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
  barBg:     { height:6, borderRadius:3, width:"100%" },
  barFill:   { height:6, borderRadius:3 },
  topP:      { fontSize:11, fontFamily:"SpaceGrotesk_400Regular" },
  empCard:   { flexDirection:"row", alignItems:"flex-start", gap:12 },
  empAv:     { width:40, height:40, borderRadius:20, justifyContent:"center", alignItems:"center", marginTop:2 },
  empAvT:    { fontSize:13, fontFamily:"Syne_700Bold" },
  empty:     { alignItems:"center", marginTop:40, gap:12, paddingHorizontal:20 },
  emptyT:    { fontSize:18, fontFamily:"Syne_700Bold" },
  emptyD:    { fontSize:13, fontFamily:"SpaceGrotesk_400Regular", textAlign:"center" },
});
