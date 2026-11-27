import "./App.css";

function App() {
  const hoje = new Date();

  const nomeMes = hoje.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span>PREMIER</span>
          <strong>Social Planner</strong>
        </div>

        <button className="new-content">
          <span>+</span>
          Novo conteúdo
        </button>

        <nav>
          <button className="active">Calendário</button>
          <button>Conteúdos</button>
          <button>Marcas</button>
          <button>Responsáveis</button>
          <button>Configurações</button>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">PLANEJAMENTO DE CONTEÚDO</p>
            <h1>{nomeMes}</h1>
          </div>

          <button className="today">Hoje</button>
        </header>

        <section className="summary">
          <div>
            <strong>34</strong>
            <span>Conteúdos</span>
          </div>

          <div>
            <strong>8</strong>
            <span>Em produção</span>
          </div>

          <div>
            <strong>5</strong>
            <span>Aguardando aprovação</span>
          </div>

          <div>
            <strong>14</strong>
            <span>Publicados</span>
          </div>
        </section>

        <section className="filters">
          <button>Todas as marcas ▾</button>
          <button>Formato ▾</button>
          <button>Status ▾</button>
          <button>Responsável ▾</button>
        </section>

        <section className="calendar">
          <div className="weekdays">
            <span>SEG</span>
            <span>TER</span>
            <span>QUA</span>
            <span>QUI</span>
            <span>SEX</span>
            <span>SÁB</span>
            <span>DOM</span>
          </div>

          <div className="days">
            {Array.from({ length: 35 }).map((_, index) => (
              <div className="day" key={index}>
                <div className="day-header">
                  <span>{index + 1 <= 30 ? index + 1 : ""}</span>

                  {index + 1 <= 30 && (
                    <button className="day-add">+</button>
                  )}
                </div>

                {index === 2 && (
                  <div className="content-card">
                    <span className="brand kia">KIA</span>
                    <strong>Tasman pronta entrega</strong>
                    <small>REELS</small>
                    <p>Em produção</p>
                  </div>
                )}

                {index === 5 && (
                  <div className="content-card">
                    <span className="brand ram">RAM</span>
                    <strong>Dakota Big Horn</strong>
                    <small>FEED</small>
                    <p>Aprovado</p>
                  </div>
                )}

                {index === 9 && (
                  <div className="content-card">
                    <span className="brand jeep">JEEP + RAM</span>
                    <strong>Plantão especial</strong>
                    <small>STORIES</small>
                    <p>Planejado</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;