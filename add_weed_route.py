import re

def add_route():
    filepath = 'frontend/src/App.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace(
        """          {activeTab === 'simulation' && (
            <SimulatedViewPage />
          )}

        </div>""", 
        """          {activeTab === 'simulation' && (
            <SimulatedViewPage />
          )}

          {activeTab === 'weeds' && (
            <WeedManagementPage />
          )}

        </div>"""
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Added WeedManagementPage route.")

if __name__ == '__main__':
    add_route()
